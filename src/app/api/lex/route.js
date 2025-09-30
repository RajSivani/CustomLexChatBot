import { NextResponse } from "next/server";
import { LexRuntimeV2Client, RecognizeTextCommand } from "@aws-sdk/client-lex-runtime-v2";

export async function POST(request) {
  const { text, sessionId } = await request.json();
  console.log("Incoming request to /api/lex:", { text, sessionId });

  // Validate environment variables
  if (!process.env.NEXT_PUBLIC_AWS_REGION|| !process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID|| !process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY || !process.env.NEXT_PUBLIC_BOT_ID|| !process.env.NEXT_PUBLIC_BOT_ALIAS_ID|| !process.env.NEXT_PUBLIC_BOT_LOCALE_ID) {
    console.error("Missing or invalid environment variables:", {
      AWS_REGION: process.env.NEXT_PUBLIC_AWS_REGION,
      AWS_ACCESS_KEY_ID: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID ? "Set" : "Missing",
      AWS_SECRET_ACCESS_KEY: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY? "Set" : "Missing",
      BOT_ID: process.env.NEXT_PUBLIC_BOT_ID? "Set" : "Missing",
      BOT_ALIAS_ID: process.env.NEXT_PUBLIC_BOT_ALIAS_ID? "Set" : "Missing",
      BOT_LOCALE_ID: process.env.NEXT_PUBLIC_BOT_LOCALE_ID ? "Set" : "Missing",
    });
    return NextResponse.json(
      {
        messages: [{ contentType: "PlainText", content: "Server configuration error." }],
        sessionAttributes: {},
      },
      { status: 500 }
    );
  }

  const client = new LexRuntimeV2Client({
    region: process.env.NEXT_PUBLIC_AWS_REGION,
    credentials: {
      accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
    },
  });

  const command = new RecognizeTextCommand({
    botId: process.env.NEXT_PUBLIC_BOT_ID,
    botAliasId: process.env.NEXT_PUBLIC_BOT_ALIAS_ID,
    localeId: process.env.NEXT_PUBLIC_BOT_LOCALE_ID,
    sessionId,
    text,
  });

  try {
    const response = await client.send(command);
    console.log("Lex response:", response);
    return NextResponse.json({
      messages: response.messages || [],
      
      sessionAttributes: response.sessionState?.sessionAttributes || {},
    });
  } catch (err) {
    console.error("Lex error:", err);
    return NextResponse.json(
      {
        messages: [{ contentType: "PlainText", content: "Error connecting to bot." }],
        sessionAttributes: {},
      },
      { status: 500 }
    );
  }
}