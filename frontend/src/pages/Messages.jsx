import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../services/api";

function Messages() {
  const { conversationId } = useParams();

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [contact, setContact] = useState(null);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const currentUserId = Number(localStorage.getItem("user_id"));

  const isHouseHunter = useMemo(() => {
    return (
      conversation &&
      Number(conversation.house_hunter_id) === currentUserId
    );
  }, [conversation, currentUserId]);

  const loadMessages = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      setError("");

      const response = await api.get(
        `/messages/conversations/${conversationId}/messages`
      );

      const data = response.data || {};

      setConversation(data.conversation || null);
      setMessages(data.messages || []);
      setContact(data.contact || null);
      setAiAvailable(Boolean(data.ai_available));
    } catch (err) {
      console.error(err);

      if (err.response?.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_id");
        localStorage.removeItem("user");
        window.location.href = "/login";
        return;
      }

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
      setError("");

      const response = await api.post(
        `/messages/conversations/${conversationId}/messages`,
        {
          content: trimmedContent,
        }
      );

      const sentMessage = response.data?.message;
      const aiReply = response.data?.ai_reply;

      if (sentMessage) {
        setMessages((previousMessages) => {
          const nextMessages = [...previousMessages];

          if (!nextMessages.some((item) => item.id === sentMessage.id)) {
            nextMessages.push(sentMessage);
          }

          if (
            aiReply &&
            !nextMessages.some((item) => item.id === aiReply.id)
          ) {
            nextMessages.push(aiReply);
          }

          return nextMessages;
        });
      }

      if (response.data?.contact) {
        setContact(response.data.contact);
      }

      setContent("");
    } catch (err) {
      console.error(err);

      if (err.response?.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_id");
        localStorage.removeItem("user");
        window.location.href = "/login";
        return;
      }

       setError(
        err.response?.data?.detail ||
          "Failed to send message."
      );
    } finally {
      setSending(false);
    }
  };

  const useInquiryTemplate = () => {
    const propertyTitle = conversation?.property?.title || "this property";

    setContent(
      `Hi, I am interested in ${propertyTitle}. Is it still available? I would like to know the current rent, viewing availability and any other important details. Thank you.`
    );
  };

  const formatMessageTime = (dateString) => {
    if (!dateString) {
      return "";
    }

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return "";
    }
     return date.toLocaleString([], {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  const propertyTitle =
    conversation?.property?.title ||
    `Conversation #${conversationId}`;

  const propertyLocation = [
    conversation?.property?.area,
    conversation?.property?.town,
    conversation?.property?.county,
  ]
    .filter(Boolean)
    .join(", ");

  const contactLabel =
    contact?.role ||
    (isHouseHunter ? "Landlord" : "House Hunter");

  return (
    <div className="messages-page">
      <div className="messages-container">
        <div className="messages-header">
          <div>
            <Link
              to="/messages"
              className="back-link"
            >
             ← Back to messages
            </Link>

            <span className="messages-eyebrow">
              PROPERTY CONVERSATION
            </span>

            <h1>{propertyTitle}</h1>

            <p>
              {propertyLocation || "Property details"}
            </p>
          </div>

          {contact?.phone_number && (
            <a
              href={`tel:${contact.phone_number}`}
              className="messages-call-button"
            >
              📞 Call {contactLabel}
            </a>
          )}
        </div>

        {isHouseHunter && (
          <div className="messages-contact-notice">
            <div className="messages-contact-icon">📞</div>
            <div>
              <strong>
                Need a quick confirmation?
              </strong>
                            <p>
                You can message the {contactLabel.toLowerCase()} here.
                For current availability, viewing arrangements, exact
                location or final confirmation, call them directly.
              </p>
            </div>

            {contact?.phone_number && (
              <a
                href={`tel:${contact.phone_number}`}
                className="messages-call-small"
              >
                Call now
              </a>
            )}
          </div>
        )}

        {!isHouseHunter && (
          <div className="messages-landlord-notice">
            <strong>🏠 House hunter inquiry</strong>
            <p>
              Reply directly to the house hunter about this property.
              Keep availability, pricing and viewing information accurate.
            </p>
          </div>
        )}
          {isHouseHunter && aiAvailable && (
          <div className="messages-ai-notice">
            <span>🤖</span>
            <div>
              <strong>NyumbaDirect AI may assist</strong>
              <p>
                If the landlord or property manager has not replied,
                NyumbaDirect AI can provide guidance from the listing. AI
                messages are clearly labelled and do not represent the
                landlord.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="messages-error">
            <strong>Something went wrong</strong>
            <p>{error}</p>
          </div>
        )}

        <div className="messages-card">
          <div className="messages-list">
            {loading ? (
              <div className="messages-status">
                <p>Loading conversation...</p>
              </div>

            ) : messages.length === 0 ? (
              <div className="messages-status">
                <div className="empty-message-icon">💬</div>
                <h2>Start the conversation</h2>
                <p>
                  Send the {isHouseHunter ? "landlord or property manager" : "house hunter"} a message about this property.
                </p>
              </div>
            ) : (
              messages.map((message) => {
                const isAi = Boolean(message.is_ai);
                const isMine =
                  !isAi &&
                  Number(message.sender_id) === currentUserId;

                return (
                  <div
                    key={message.id}
                    className={`message-item ${
                      isAi
                        ? "message-ai"
                        : isMine
                          ? "message-mine"
                          : "message-theirs"
                    }`}
                  >
                    {!isMine && (
                      <div
                        className={`message-avatar ${
                             isAi ? "message-avatar-ai" : ""
                        }`}
                      >
                        {isAi ? "🤖" : "👤"}
                      </div>
                    )}

                    <div className="message-content">
                      {isAi && (
                        <div className="message-sender-label">
                          🤖 NyumbaDirect AI
                        </div>
                      )}

                      {!isAi && !isMine && (
                        <div className="message-sender-label">
                          {message.sender_name || contactLabel}
                        </div>
                      )}

                      {isMine && (
                        <div className="message-sender-label message-sender-mine">
                          You
                        </div>
                      )}
                       <div
                        className={`message-bubble ${
                          isAi ? "message-bubble-ai" : ""
                        }`}
                      >
                        {message.content}
                      </div>

                      <small>
                        {formatMessageTime(message.created_at)}

                        {!isMine && !isAi && message.is_read && (
                          <span className="read-status"> • Read</span>
                        )}
                      </small>
                    </div>

                    {isMine && (
                      <div className="message-avatar">👤</div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="message-quick-actions">
            {isHouseHunter && (
                 <button
                type="button"
                onClick={useInquiryTemplate}
                disabled={sending}
              >
                ✉️ Use inquiry template
              </button>
            )}

            {contact?.phone_number && (
              <a href={`tel:${contact.phone_number}`}>
                📞 Call {contactLabel}
              </a>
            )}
          </div>

          <form className="message-form" onSubmit={sendMessage}>
            <input
              type="text"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder={
                isHouseHunter
                  ? "Ask about availability, rent, viewing or other details..."
                  : "Reply to the house hunter..."
              }
              disabled={sending}
            />

            <button
                 type="submit"
              disabled={sending || !content.trim()}
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        .messages-eyebrow {
          display: block;
          margin-top: 18px;
          color: #2563eb;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .12em;
        }
        .messages-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
        }
        .messages-header h1 {
          margin: 6px 0 4px;
        }
        .messages-header p {
          margin: 0;
        }
        .messages-call-button,
        .messages-call-small,
        .message-quick-actions a {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          border-radius: 10px;
          background: #0f766e;
          color: #fff;
          font-weight: 800;
        }
        .messages-call-button {
          min-height: 46px;
          padding: 0 16px;
          white-space: nowrap;
        }
        .messages-contact-notice,
        .messages-ai-notice,
        .messages-landlord-notice {
          display: flex;
          align-items: center;
          gap: 14px;
          margin: 18px 0;
          padding: 15px 17px;
          border-radius: 14px;
          border: 1px solid #dbeafe;
          background: #eff6ff;
        }
        .messages-contact-icon {
          font-size: 22px;
        }
        .messages-contact-notice p,
        .messages-ai-notice p,
        .messages-landlord-notice p {
          margin: 4px 0 0;
          color: #64748b;
          line-height: 1.5;
          font-size: 13px;
        }
                  margin-bottom: 16px;
        }
        .message-item.message-mine {
          justify-content: flex-end;
        }
        .message-item.message-ai {
          align-items: flex-start;
        }
        .message-avatar {
          flex: 0 0 34px;
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #f1f5f9;
        }
        .message-avatar-ai {
          background: #ede9fe;
        }
        .message-content {
          max-width: min(76%, 680px);
        }
        .message-sender-label {
          margin: 0 0 4px 3px;
          color: #475569;
          font-size: 11px;
          font-weight: 800;
        }
        .message-sender-mine {
          text-align: right;
          margin-right: 3px;
        }
        .message-bubble {
          padding: 11px 14px;
          border-radius: 15px 15px 15px 5px;
          background: #f1f5f9;
          color: #0f172a;
          line-height: 1.55;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .message-mine .message-bubble {
          border-radius: 15px 15px 5px 15px;
          background: #0f766e;
          color: white;
        }
        .message-bubble-ai {
          border: 1px solid #ddd6fe;
          background: #f5f3ff;
        }
        .message-content small {
          display: block;
          margin: 5px 3px 0;
          color: #94a3b8;
          font-size: 10px;
        }
        .message-mine .message-content small {
          text-align: right;
        }
        .read-status {
          color: #0f766e;
        }
        .message-quick-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 12px 16px 0;
        }
        .message-quick-actions button,
        .message-quick-actions a {
          min-height: 38px;
          padding: 0 12px;
          border: 1px solid #cbd5e1;
          background: white;
          color: #334155;
          cursor: pointer;
          font-size: 12px;
        }
        .message-quick-actions a {
          border-color: #0f766e;
          background: #0f766e;
          color: white;
        }
        .message-quick-actions button:hover {
          border-color: #0f766e;
          color: #0f766e;
        }
        .conversation-ai-notice {
          display: flex;
          gap: 12px;
          margin: 18px 0;
          padding: 15px 17px;
          border: 1px solid #ddd6fe;
          border-radius: 14px;
          background: #f5f3ff;
        }
        .conversation-ai-icon {
          font-size: 22px;
        }
        .conversation-ai-notice p {
          margin: 4px 0 0;
          color: #64748b;
          line-height: 1.5;
          font-size: 13px;
        }
        .conversation-phone,
        .conversation-rent {
          margin-top: 5px;
          color: #0f766e;
          font-size: 12px;
          font-weight: 750;
        }
        @media (max-width: 700px) {
          .messages-header {
            align-items: flex-start;
            flex-direction: column;
          }
          .messages-call-button {
            width: 100%;
          }
          .messages-contact-notice,
          .messages-ai-notice,
          .messages-landlord-notice {
            align-items: flex-start;
            flex-wrap: wrap;
          }
          .messages-call-small {
            margin-left: 0;
          }
          .message-content {
            max-width: 84%;
          }
        }
        @media (max-width: 480px) {
          .message-content {
            max-width: 82%;
          }
          .message-avatar {
            flex-basis: 30px;
            width: 30px;
            height: 30px;
          }
          .message-bubble {
            padding: 10px 12px;
          }
        }
      `}</style>
    </div>
  );
}

export default Messages;

