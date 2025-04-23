import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import EmojiPicker from "emoji-picker-react";
import "./App.css";

const formatTime = (isoString) => {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const App = () => {
  const socket = useRef(null);
  const chatEndRef = useRef(null);
  const [userName, setUserName] = useState("");
  const [joined, setJoined] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingIndicators, setTypingIndicators] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});
  const [privateMessages, setPrivateMessages] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const typingTimeoutRef = useRef(null);
  const hasLoadedLocalStorage = useRef(false);

  const getInitials = (name) => {
    const parts = name.trim().split(" ");
    return parts.map((p) => p[0].toUpperCase()).join("").slice(0, 2);
  };

  // Load from localStorage only once on initial mount
  useEffect(() => {
    if (!hasLoadedLocalStorage.current) {
      const savedUserName = localStorage.getItem("userName");
      const savedMessages = localStorage.getItem("messages");
      const savedPrivateMessages = localStorage.getItem("privateMessages");

      if (savedMessages) setMessages(JSON.parse(savedMessages));
      if (savedPrivateMessages) setPrivateMessages(JSON.parse(savedPrivateMessages));
      if (savedUserName) {
        setUserName(savedUserName);
        setJoined(true);
      }

      hasLoadedLocalStorage.current = true;
    }
  }, []);

  // Set up socket connection once user is joined
  useEffect(() => {
    if (!joined || !userName) return;

    socket.current = io("https://messanger-backend-a4qc.onrender.com");

    socket.current.on("connect", () => {
      socket.current.emit("user-joined", userName);
    });

    socket.current.on("receive-message", (data) => {
      setMessages((prev) => {
        const updated = [...prev, data];
        localStorage.setItem("messages", JSON.stringify(updated));
        return updated;
      });
    });

    socket.current.on("update-user-list", (userList) => {
      setOnlineUsers(userList.filter((user) => user !== userName));
    });

    socket.current.on("user-typing", ({ user, from }) => {
      setTypingIndicators((prev) => ({
        ...prev,
        [from || "public"]: [...new Set([...(prev[from || "public"] || []), user])],
      }));
    });

    socket.current.on("user-stop-typing", ({ user, from }) => {
      const scope = from || "public";
      setTypingIndicators((prev) => {
        const updated = (prev[scope] || []).filter((u) => u !== user);
        return { ...prev, [scope]: updated };
      });
    });

    socket.current.on("receive-private-message", (data) => {
      setPrivateMessages((prev) => {
        const updated = { ...prev };
        if (!updated[data.from]) updated[data.from] = [];
        updated[data.from].push(data);
        localStorage.setItem("privateMessages", JSON.stringify(updated));
        return updated;
      });

      if (data.from !== selectedUser) {
        setUnreadCounts((prev) => ({
          ...prev,
          [data.from]: (prev[data.from] || 0) + 1,
        }));
      }
    });

    return () => {
      socket.current?.disconnect();
      socket.current = null;
    };
  }, [joined, userName, selectedUser]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, privateMessages, selectedUser]);

  const joinChat = () => {
    if (userName.trim()) {
      localStorage.setItem("userName", userName);
      setJoined(true);
    }
  };

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    const typingPayload = { to: selectedUser || null };

    if (!isTyping) {
      setIsTyping(true);
      socket.current?.emit("typing", typingPayload);
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.current?.emit("stop-typing", typingPayload);
    }, 1000);
  };

  const sendMessage = () => {
    if (message.trim()) {
      socket.current?.emit("send-message", { type: "text", content: message });
      setMessage("");
    }
  };

  const sendPrivateMessage = () => {
    if (message.trim() && selectedUser) {
      socket.current?.emit("private-message", { to: selectedUser, message });
      setPrivateMessages((prev) => {
        const updated = { ...prev };
        if (!updated[selectedUser]) updated[selectedUser] = [];
        updated[selectedUser].push({
          from: userName,
          content: message,
          time: new Date().toISOString(),
        });
        localStorage.setItem("privateMessages", JSON.stringify(updated));
        return updated;
      });
      setMessage("");
    }
  };

  const handleEmojiClick = (emojiData) => {
    setMessage((prev) => prev + emojiData.emoji);
  };

  const logout = () => {
    localStorage.removeItem("messages");
    localStorage.removeItem("privateMessages");
    localStorage.removeItem("userName");

    setUserName("");
    setMessages([]);
    setPrivateMessages({});
    setUnreadCounts({});
    setSelectedUser(null);
    setTypingIndicators({});
    setJoined(false);

    if (socket.current) {
      socket.current.disconnect();
      socket.current = null;
    }
  };

  return (
    <div className="chat-container">
      {!joined ? (
        <div className="username-input">
          <input
            type="text"
            placeholder="Enter your name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
          <button onClick={joinChat}>Join Chat</button>
        </div>
      ) : (
        <>
          <header className="chat-header">
            Welcome, {userName}
            <button onClick={logout} className="logout-btn">⏻</button>
          </header>

          <div className="chat-body">
            <div className="user-list">
              <ul>
                <li className="self-name">👤 {userName} (You)</li>
                <li
                  onClick={() => setSelectedUser(null)}
                  className={!selectedUser ? "selected" : ""}
                >
                  🟢 Public Chat
                </li>
                <h4>Online Users</h4>
                {onlineUsers.map((user, index) => (
                  <li
                    key={index}
                    onClick={() => {
                      setSelectedUser(user);
                      setUnreadCounts((prev) => ({ ...prev, [user]: 0 }));
                    }}
                    className={selectedUser === user ? "selected" : ""}
                  >
                    <div className="user-avatar">{getInitials(user)}</div>
                    {user}
                    {unreadCounts[user] > 0 && (
                      <span className="msg-count">
                        {unreadCounts[user] > 99 ? "99+" : unreadCounts[user]}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="chat-box">
              {(selectedUser
                ? privateMessages[selectedUser] || []
                : messages
              ).map((msg, index) => (
                <div
                  key={index}
                  className={`chat-msg ${
                    (msg.user || msg.from) === userName ? "self" : "other"
                  }`}
                >
                  <div className="chat-msg-wrapper">
                    <div className="chat-avatar">{getInitials(msg.user || msg.from)}</div>
                    <div className="chat-content">
                      <span className="chat-user">{msg.user || msg.from}</span>
                      <div className="chat-text">{msg.content}</div>
                      <div className="chat-time">{formatTime(msg.time)}</div>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
              {typingIndicators[selectedUser || "public"]?.length > 0 && (
                <div className="typing-indicator">
                  {typingIndicators[selectedUser || "public"].join(", ")}{" "}
                  {typingIndicators[selectedUser || "public"].length === 1 ? "is" : "are"} typing...
                </div>
              )}
            </div>
          </div>

          <div className="chat-input">
            <button onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
              😊
            </button>
            {showEmojiPicker && (
              <div className="emoji-picker">
                <EmojiPicker onEmojiClick={handleEmojiClick} />
              </div>
            )}
            <input
              type="text"
              placeholder={selectedUser ? `Message ${selectedUser}` : "Type a message..."}
              value={message}
              onChange={handleInputChange}
              onKeyDown={(e) => e.key === "Enter" && (selectedUser ? sendPrivateMessage() : sendMessage())}
            />
            <button onClick={selectedUser ? sendPrivateMessage : sendMessage}>Send</button>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
