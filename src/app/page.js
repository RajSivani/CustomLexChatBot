"use client";
import "./chatbot.css";
import { useState, useRef, useEffect } from "react";
import { VscSend } from "react-icons/vsc";
import { TbMessageChatbot } from "react-icons/tb";
import { IoCloseSharp } from "react-icons/io5";
import {
  DefaultDeviceController,
  DefaultMeetingSession,
  ConsoleLogger,
  LogLevel,
  MeetingSessionConfiguration,
  DefaultAudioVideoFacade,
} from "amazon-chime-sdk-js";

export default function Home() {
  const [move, setMove] = useState(false);
  const [userMsg, setUserMsg] = useState("");
  const [messages, setMessages] = useState([]);
  const [ischatbotopen, setischatbotopen] = useState(false);
  const [sessionAttributes, setSessionAttributes] = useState({});
  const [disabledButtons, setDisabledButtons] = useState({});
  const chatRef = useRef(null);
  const sessionId = useRef("user-" + Date.now());

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const sendToLex = async (text) => {
    try {
      const res = await fetch("/api/lex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          sessionId: sessionId.current,
        }),
      });
      const data = await res.json();
      if (data.messages.length === 0) {
        return {
          messages: [{ type: "text", text: "Sorry, I didn’t understand that." }],
          sessionAttributes: data.sessionAttributes,
        };
      }

      const formattedMessages = data.messages.map((msg) => {
        switch (msg.contentType) {
          case "PlainText":
            return { type: "text", text: msg.content };
          case "CustomPayload":
            try {
              return { type: "payload", payload: JSON.parse(msg.content) };
            } catch {
              return { type: "text", text: msg.content };
            }
          case "ImageResponseCard":
            return {
              type: "imageCard",
              title: msg.imageResponseCard?.title,
              subtitle: msg.imageResponseCard?.subtitle,
              imageUrl: msg.imageResponseCard?.imageUrl,
              buttons: msg.imageResponseCard?.buttons?.map((b) => ({
                text: b.text,
                value: b.value,
              })) || [],
            };
          default:
            return { type: "text", text: msg.content || "" };
        }
      });

      return {
        messages: formattedMessages,
        sessionAttributes: data.sessionAttributes,
      };
    } catch (err) {
      console.error("Lex API error:", err);
      return {
        messages: [{ type: "text", text: "Error connecting to bot." }],
        sessionAttributes: {},
      };
    }
  };


  const startWebRTCCall = async () => {
    try {
      // 1️⃣ Call backend API to start WebRTC contact
      const res = await fetch("/api/start-webrtc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attributes: { userName: "Customer" } }),
      });
      if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
      const data = await res.json();
  
      if (!data.success) throw new Error(data.error || "Failed to start call");
      console.log("API Response:", data);
  
      // 2️⃣ Use connectionData directly
      const { Meeting, Attendee } = data.connectionData;
  
      // 3️⃣ Initialize Amazon Chime SDK
      const configuration = new MeetingSessionConfiguration(Meeting, Attendee);
  
      // 4️⃣ Set up device controller and meeting session
      const logger = new ConsoleLogger("ChimeMeetingLogs", LogLevel.INFO);
      const deviceController = new DefaultDeviceController(logger);
      const meetingSession = new DefaultMeetingSession(configuration, logger, deviceController);
  
      // 5️⃣ Optional microphone track (proceed without if none found)
      let audioInputMessage = "Connected with audio input.";
      try {
        const audioInputDevices = await deviceController.listAudioInputDevices();
        if (audioInputDevices.length > 0) {
          await deviceController.startAudioInput(audioInputDevices[0].deviceId);
        } else {
          audioInputMessage = "No microphone found. Connected in listen-only mode.";
          console.log("No microphone detected, proceeding without audio input.");
        }
      } catch (err) {
        console.warn("Microphone access error:", err);
        audioInputMessage = "Microphone access issue. Connected in listen-only mode.";
      }
  
      // 6️⃣ Bind audio output
      const audioElement = document.createElement("audio");
      audioElement.autoplay = true;
      document.body.appendChild(audioElement);
      await meetingSession.audioVideo.bindAudioElement(audioElement);
  
      // 7️⃣ Start the meeting session
      meetingSession.audioVideo.start();
  
      setMessages((prev) => [
        ...prev,
        { sender: "bot", type: "text", text: `WebRTC call started! ${audioInputMessage}` },
      ]);
    } catch (err) {
      console.error("WebRTC error:", err);
      setMessages((prev) => [
        ...prev,
        { sender: "bot", type: "text", text: `Error starting voice call: ${err.message}` },
      ]);
    }
  };
  const handleConvo = async (e) => {
    e.preventDefault();
    if (!userMsg.trim()) return;

    const msg = userMsg;
    setUserMsg("");
    setMessages((prev) => [...prev, { sender: "user", type: "text", text: msg }]);

    try {
      const { messages: lexMessages, sessionAttributes: newAttrs } = await sendToLex(msg);
      setSessionAttributes(newAttrs);

      lexMessages.forEach((m) => {
        if (m.type === "payload" && m.payload.templateType === "Escalate") {
          startWebRTCCall();
        }
      });

      setMessages((prev) => [
        ...prev,
        ...lexMessages.map((m) => ({ sender: "bot", ...m })),
      ]);
    } catch (err) {
      console.error("Lex error:", err);
      setMessages((prev) => [
        ...prev,
        { sender: "bot", type: "text", text: "Error connecting to bot." },
      ]);
    }
  };

  const handleConvoFromButton = async (choice, cardIndex) => {
    setDisabledButtons((prev) => ({ ...prev, [cardIndex]: true }));
    setMessages((prev) => [...prev, { sender: "user", type: "text", text: choice }]);

    try {
      const { messages: lexMessages, sessionAttributes: newAttrs } = await sendToLex(choice);
      setSessionAttributes(newAttrs);

      lexMessages.forEach((m) => {
        if (m.type === "payload" && m.payload.templateType === "Escalate") {
          startWebRTCCall();
        }
      });

      setMessages((prev) => [
        ...prev,
        ...lexMessages.map((m) => ({ sender: "bot", ...m })),
      ]);
    } catch (err) {
      console.error("Lex error:", err);
      setMessages((prev) => [
        ...prev,
        { sender: "bot", type: "text", text: "Error connecting to bot." },
      ]);
    }
  };

  return (
    <div className="chatbot-div">
      {ischatbotopen ? (
        <div className={`chat-container ${move ? "move-bottom" : "move-top"}`}>
          <div
            onClick={() => setischatbotopen((prev) => !prev)}
            className="chat-close-option"
          >
            <IoCloseSharp size={25} color="#e8663d" />
          </div>
          <div className="chat" ref={chatRef}>
            {messages.map((msg, index) => {
              if (msg.type === "text") {
                return (
                  <p
                    key={index}
                    className={msg.sender === "user" ? "user-msg" : "bot-msg"}
                  >
                    {msg.text}
                  </p>
                );
              }

              if (msg.type === "payload" && msg.payload.templateType === "QuickReply") {
                const { replyMessage, content } = msg.payload.data;
                return (
                  <div key={index}>
                    <p className="bot-msg">{replyMessage.title}</p>
                    <p className="bot-msg">{content.title}</p>
                    <div className="quick-replies">
                      {content.elements.map((btn, i) => (
                        <button
                          key={i}
                          className="quick-btn"
                          onClick={() => handleConvoFromButton(btn.title, index)}
                          disabled={disabledButtons[index]}
                        >
                          {btn.title}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }

              if (msg.type === "imageCard") {
                return (
                  <div key={index} className="bot-msg image-card">
                    {msg.title && <p className="card-title">{msg.title}</p>}
                    {msg.subtitle && <p className="card-subtitle">{msg.subtitle}</p>}
                    {msg.imageUrl && <img src={msg.imageUrl} alt={msg.title} />}
                    <div className="quick-replies">
                      {msg.buttons.map((btn, i) => (
                        <button
                          key={i}
                          className="quick-btn"
                          onClick={() => handleConvoFromButton(btn.value, index)}
                          disabled={disabledButtons[index]}
                        >
                          {btn.text}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>

          <form onSubmit={handleConvo} className="chat-form">
            <input
              value={userMsg}
              onChange={(e) => setUserMsg(e.target.value)}
              placeholder="Send a message to chatbot"
            />
            <button type="submit">
              <VscSend className="send-button" />
            </button>
          </form>
        </div>
      ) : (
        <div
          className="chat-icon"
          onClick={() => setischatbotopen((prev) => !prev)}
        >
          <TbMessageChatbot size={40} color="#e8663d" />
        </div>
      )}
    </div>
  );
}