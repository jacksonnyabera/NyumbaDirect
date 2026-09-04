import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../services/api";

function Messages() {
  const { conversationId } = useParams();

  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const currentUserId = Number(
    localStorage.getItem("user_id")
  );

  const loadMessages = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      setError("");

      const response = await api.get(
        `/messages/conversations/${conversationId}/messages`
      );

      setMessages(response.data || []);
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.detail ||
          "Failed to load messages."
      );
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const markMessagesAsRead = async () => {
    try {
      await api.patch(
        `/messages/conversations/${conversationId}/messages/read`
      );
    } catch (err) {
      console.error(
        "Failed to mark messages as read:",
        err
      );
    }
  };

  useEffect(() => {
    const loadConversation = async () => {
      await loadMessages();
      await markMessagesAsRead();
    };

    loadConversation();

    const interval = setInterval(() => {
      loadMessages(false);
    }, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [conversationId]);

  const sendMessage = async (event) => {
    event.preventDefault();

    const trimmedContent = content.trim();

    if (!trimmedContent) {
      return;
    }

    try {
      setSending(true);

      const response = await api.post(
        `/messages/conversations/${conversationId}/messages`,
        {
          content: trimmedContent,
        }
      );

      setMessages((previousMessages) => {
        const alreadyExists = previousMessages.some(
          (message) =>
            message.id === response.data.id
        );

        if (alreadyExists) {
          return previousMessages;
        }

        return [
          ...previousMessages,
          response.data,
        ];
      });

      setContent("");
    } catch (err) {
      console.error(err);

      alert(
        err.response?.data?.detail ||
          "Failed to send message."
      );
    } finally {
      setSending(false);
    }
  };

  const formatMessageTime = (dateString) => {
    if (!dateString) {
      return "";
    }

    return new Date(dateString).toLocaleString([], {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  return (
    <div className="messages-page">
      <div className="messages-container">

        {/* HEADER */}
        <div className="messages-header">
          <div>
            <Link
              to="/properties"
              className="back-link"
            >
              ← Back to properties
            </Link>

            <h1>Messages</h1>

            <p>
              Conversation #{conversationId}
            </p>
          </div>
        </div>

        {/* CHAT CARD */}
        <div className="messages-card">

          {/* MESSAGES */}
          <div className="messages-list">

            {loading ? (
              <div className="messages-status">
                <p>Loading messages...</p>
              </div>
            ) : error ? (
              <div className="messages-status">
                <p>{error}</p>

                <button
                  type="button"
                  onClick={() => loadMessages()}
                >
                  Try again
                </button>
              </div>
            ) : messages.length === 0 ? (
              <div className="messages-status">
                <div className="empty-message-icon">
                  💬
                </div>

                <h2>Start the conversation</h2>

                <p>
                  Send a message to the property owner.
                </p>
              </div>
            ) : (
              messages.map((message) => {
                const isMine =
                  Number(message.sender_id) ===
                  currentUserId;

                return (
                  <div
                    key={message.id}
                    className={`message-item ${
                      isMine
                        ? "message-mine"
                        : "message-theirs"
                    }`}
                  >
                    {!isMine && (
                      <div className="message-avatar">
                        👤
                      </div>
                    )}

                    <div className="message-content">
                      <div className="message-bubble">
                        {message.content}
                      </div>

                      <small>
                        {formatMessageTime(
                          message.created_at
                        )}

                        {!isMine &&
                          message.is_read && (
                            <span className="read-status">
                              {" "}
                              • Read
                            </span>
                          )}
                      </small>
                    </div>

                    {isMine && (
                      <div className="message-avatar">
                        👤
                      </div>
                    )}
                  </div>
                );
              })
            )}

          </div>

          {/* MESSAGE INPUT */}
          <form
            className="message-form"
            onSubmit={sendMessage}
          >
            <input
              type="text"
              value={content}
              onChange={(event) =>
                setContent(event.target.value)
              }
              placeholder="Type your message..."
              disabled={sending}
            />

            <button
              type="submit"
              disabled={
                sending || !content.trim()
              }
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}

export default Messages;
