"use client";
import "./chatbot.css";
import { useState, useRef, useEffect } from "react";
import { VscSend } from "react-icons/vsc";
import { TbMessageChatbot } from "react-icons/tb";
import { IoCloseSharp } from "react-icons/io5";
import { FcEndCall } from "react-icons/fc";
import { IoMdCall } from "react-icons/io";
import { IoMic, IoMicOff } from "react-icons/io5";
import { IoVideocam, IoVideocamOff } from "react-icons/io5";
import { TfiArrowCircleDown } from "react-icons/tfi";
import { TfiArrowCircleUp } from "react-icons/tfi";
import {
  DefaultDeviceController,
  DefaultMeetingSession,
  ConsoleLogger,
  LogLevel,
  MeetingSessionConfiguration,
} from "amazon-chime-sdk-js";
import ChatbotDs from "./(dsLayer)/ChatbotDS";
export default function Home() {
  const [move, setMove] = useState(false);
  const [userMsg, setUserMsg] = useState("");
  const [messages, setMessages] = useState([]);
  const [ischatbotopen, setischatbotopen] = useState(false);
  const [sessionAttributes, setSessionAttributes] = useState({});
  const [disabledButtons, setDisabledButtons] = useState({});
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const chatRef = useRef(null);
  const sessionId = useRef("user-" + Date.now());
  const meetingSessionRef = useRef(null);
  const audioElementRef = useRef(null);
  const [contactId, setContactId] = useState(null);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [options, setOptions] = useState(false);
  const deviceControllerRef = useRef(null);
  const videoElementRef = useRef(null);
  const localVideoTileRef = useRef(null);
  const chatbotds = new ChatbotDs()

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const initChat = async () => {
      const { messages: lexMessages, sessionAttributes: newAttrs } = await sendToLex("hi");
      setSessionAttributes(newAttrs);
      setMessages((prev) => [
        ...prev,
        ...lexMessages.map((m) => ({ sender: "bot", ...m }))
      ]);
    };
  
    initChat();
  }, []);

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
          messages: [{ type: "text", text: "Sorry, I didn't understand that." }],
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
      console.error("Error in sendToLex:", err);
      return {
        messages: [{ type: "text", text: "Error connecting to bot." }],
        sessionAttributes: {},
      };
    }
  };

  const startWebRTCCall = async (withVideo = false) => {
    const requestData = { attributes: { userName: "Customer" } };
    try {
      if(!withVideo){
      setMessages((prev) => [
        ...prev,
        { 
          sender: "user", 
          type: "text", 
          text: "Start call with agent" 
        },
      ]);
}
      // Step 1: Make API call
      let response;
      if (withVideo) {
        const requestData = { attributes: { userName: "Customer" ,agentLink:withVideo } };
        console.log("links request obj",{requestData})
        response = await chatbotds.ChatbotGet({...requestData});
        if (response.success) {
          setContactId(response.data.contactId);
          console.log("Video call data:", response.data);
        } else {
          throw new Error(response.message || "Failed to start video call");
        }
      } else {
        const res = await fetch("/api/start-webrtc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestData),
        });
        if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
        response = await res.json();
        if (!response.success) throw new Error(response.error || "Failed to start audio call");
        setContactId(response.contactId);
      }
  
      // Step 2: Create session objects
      const connectionData = withVideo ? response.data.connectionData : response.connectionData;
      const { Meeting, Attendee } = connectionData;
      
      const configuration = new MeetingSessionConfiguration(Meeting, Attendee);
      const logger = new ConsoleLogger("ChimeMeetingLogs", LogLevel.INFO);
      const deviceController = new DefaultDeviceController(logger);
      deviceControllerRef.current = deviceController;
      const meetingSession = new DefaultMeetingSession(configuration, logger, deviceController);
      meetingSessionRef.current = meetingSession;
  
      // Step 3: Setup audio
      let audioInputMessage = "You are now connected to a live agent and can start your conversation.";
      try {
        const audioInputDevices = await deviceController.listAudioInputDevices();
        if (audioInputDevices.length > 0) {
          await deviceController.startAudioInput(audioInputDevices[0].deviceId);
        } else {
          audioInputMessage = "You are connected to a live agent. No microphone detected, so you'll hear the agent in listen-only mode. Feel free to connect a microphone to join the conversation.";
        }
      } catch (err) {
        console.warn("Microphone access error:", err);
        audioInputMessage = "You are connected to a live agent. We couldn't access your microphone, so you'll hear the agent in listen-only mode. Please check your settings or try again.";
      }
  
      const audioElement = document.createElement("audio");
      audioElement.autoplay = true;
      document.body.appendChild(audioElement);
      audioElementRef.current = audioElement;
      await meetingSession.audioVideo.bindAudioElement(audioElementRef.current);
      meetingSession.audioVideo.start();
      setIsCallActive(true);
      setMessages((prev) => [
        ...prev,
        { sender: "bot", type: "text", text: audioInputMessage },
      ]);
    } catch (err) {
      console.error("Error in startCall:", err);
      setMessages((prev) => [
        ...prev,
        { 
          sender: "bot", 
          type: "text", 
          text: "Oops! We couldn't connect you to the agent right now. Please check your internet connection or try again in a moment." 
        },
      ]);
    }
  };
  const startVideoCall = async () => {
    console.log("startVideoCall triggered");
    
    try {
  
      let linksResponse = await chatbotds.ChatbotVedioGet();
      const parsedData = JSON.parse(linksResponse.data);
      if (linksResponse.success) {
        console.log("Video links:", parsedData.customerLink,);

        setMessages((prev) => [
          ...prev,
          { 
            sender: "user", 
            type: "text", 
            text:  "Start video call with agent" 
          },
        ]);
     setMessages((prev) => [
          ...prev,
          { 
            sender: "bot", 
            type: "url", 
            text: `${parsedData.customerLink}`
          },
        ]);
      }
      
      await startWebRTCCall(parsedData.agentLink);
      
    } catch (error) {
      console.error("Error starting video call:", error);
      setMessages((prev) => [
        ...prev,
        { 
          sender: "bot", 
          type: "text", 
          text: "Failed to start video call. Please try again."
        },
      ]);
    }
  };

  const startAudioCall = async () => {
    console.log("startAudioCall triggered");
    await startWebRTCCall(false);
  };

  const endCall = () => {
    console.log("endCall triggered");
    if (meetingSessionRef.current && isCallActive) {
      try {
        meetingSessionRef.current.audioVideo.stop();
        if (audioElementRef.current) {
          audioElementRef.current.pause();
          document.body.removeChild(audioElementRef.current);
          audioElementRef.current = null;
        }

        if (isVideoOn && videoElementRef.current) {
          meetingSessionRef.current.audioVideo.stopLocalVideoTile();
          if (localVideoTileRef.current) {
            meetingSessionRef.current.audioVideo.removeVideoTile(localVideoTileRef.current.tileId);
          }
          document.body.removeChild(videoElementRef.current);
          videoElementRef.current = null;
          localVideoTileRef.current = null;
        }

        setIsCallActive(false);
        setIsMuted(false);
        setIsVideoOn(false);
        setMessages((prev) => [
          ...prev,
          { sender: "bot", type: "text", text: "Call ended." },
        ]);
      } catch (err) {
        console.error("Error in endCall:", err);
        setMessages((prev) => [
          ...prev,
          { sender: "bot", type: "text", text: "Error ending call." },
        ]);
      }
    } else {
      console.warn("No active call to end");
    }
  };

  const toggleMute = async () => {
    console.log("toggleMute triggered, isMuted:", isMuted);
    if (meetingSessionRef.current && deviceControllerRef.current && isCallActive) {
      try {
        if (isMuted) {
          const audioInputDevices = await deviceControllerRef.current.listAudioInputDevices();
          if (audioInputDevices.length > 0) {
            await deviceControllerRef.current.startAudioInput(audioInputDevices[0].deviceId);
            setMessages((prev) => [
              ...prev,
              { sender: "bot", type: "text", text: "Microphone unmuted." },
            ]);
            setIsMuted(false);
          }
        } else {
          await deviceControllerRef.current.stopAudioInput();
          setMessages((prev) => [
            ...prev,
            { sender: "bot", type: "text", text: "Microphone muted." },
          ]);
          setIsMuted(true);
        }
      } catch (err) {
        console.error("Error in toggleMute:", err);
        setMessages((prev) => [
          ...prev,
          { sender: "bot", type: "text", text: "Error toggling mute." },
        ]);
      }
    }
  };

  const toggleVideo = async () => {
  
    setIsVideoOn(!isVideoOn);
  };

  const handleConvo = async (e) => {
    e.preventDefault();
    if (!userMsg.trim()) return;

    const msg = userMsg;
    setUserMsg("");
    setMessages((prev) => [...prev, { sender: "user", type: "text", text: msg }]);

    try {
      const { messages: lexMessages, sessionAttributes: newAttrs } = await sendToLex(msg);
      console.log("Lex response in handleConvo:", lexMessages);
      setSessionAttributes(newAttrs);

      lexMessages.forEach((m) => {
        if (m.type === "payload" && m.payload.templateType === "Escalate") {
          const isVideoCall = m.payload.callType === "video";
          console.log("Escalation detected, isVideoCall:", isVideoCall);
          startWebRTCCall(isVideoCall);
        }
      });

      setMessages((prev) => [
        ...prev,
        ...lexMessages.map((m) => ({ sender: "bot", ...m })),
      ]);
    } catch (err) {
      console.error("Error in handleConvo:", err);
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
      console.log("Lex response in handleConvoFromButton:", lexMessages);
      setSessionAttributes(newAttrs);

      lexMessages.forEach((m) => {
        if (m.type === "payload" && m.payload.templateType === "Escalate") {
          const isVideoCall = m.payload.callType === "video";
          console.log("Escalation detected, isVideoCall:", isVideoCall);
          startWebRTCCall(isVideoCall);
        }
      });

      setMessages((prev) => [
        ...prev,
        ...lexMessages.map((m) => ({ sender: "bot", ...m })),
      ]);
    } catch (err) {
      console.error("Error in handleConvoFromButton:", err);
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
            
                if (msg.type === "url") {
                  return (
                    <div key={index} className={msg.sender === "user" ? "user-msg" : "bot-msg"}>
                        Video call initiated. Please click the link to join: <a href={msg.text} target="_blank">Join Now</a>
                    </div>
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
          {options && (
            <div className="options">
              {isCallActive ? (
                <>
                  <button onClick={endCall} className="send-button" title="End Call">
                    <FcEndCall size={25} />
                  </button>
                  <button onClick={toggleMute} className="send-button" title={isMuted ? "Unmute" : "Mute"}>
                    {isMuted ? <IoMicOff size={25} /> : <IoMic size={25} />}
                  </button>
                  <button onClick={toggleVideo} className="send-button" title={isVideoOn ? "Turn Off Video" : "Turn On Video"}>
                    {isVideoOn ? <IoVideocamOff size={25} /> : <IoVideocam size={25} />}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      console.log("Audio call button clicked");
                      startAudioCall();
                    }}
                    className="send-button"
                    title="Voice Call"
                  >
                    <IoMdCall size={25} />
                  </button>
                  <button
                    onClick={() => {
                      console.log("Video call button clicked");
                      startVideoCall();
                    }}
                    className="send-button"
                    title="Video Call"
                  >
                    <IoVideocam size={25} />
                  </button>
                </>
              )}
            </div>
          )}
          <form onSubmit={handleConvo} className="chat-form">
            <input
              value={userMsg}
              onChange={(e) => setUserMsg(e.target.value)}
              placeholder="Send a message to chatbot"
            />
            <button type="submit">
              <VscSend className="send-button" />
            </button>
            <button
              type="button"
              onClick={() => setOptions(!options)}
            >
              {options ? (
                <TfiArrowCircleDown size={20} color="#e8663d" />
              ) : (
                <TfiArrowCircleUp size={20} color="#e8663d" />
              )}
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

