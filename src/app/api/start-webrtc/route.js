import { ConnectClient, StartWebRTCContactCommand } from '@aws-sdk/client-connect';
// import { activeCalls, notifyAgents } from '../utils/callManager';

const connectClient = new ConnectClient({
  region: process.env.AWS_REGION || 'us-west-2',
  credentials: {
    accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
  },
});

export async function POST(request) {
  console.log('🚀 Customer initiating call');
  
  try {
    const { attributes } = await request.json();

    const command = new StartWebRTCContactCommand({
      InstanceId: process.env.NEXT_PUBLIC_CONNECT_INSTANCE_ID,
      ContactFlowId: process.env.NEXT_PUBLIC_CONNECT_CONTACT_FLOW_ID,
      ParticipantDetails: {
        DisplayName: attributes?.userName || 'Customer',
      },
      Attributes: attributes || {},
    });

    console.log('📞 Calling AWS Connect...');
    const response = await connectClient.send(command);

    const contactId = response.ContactId;
    console.log(`✅ Contact created: ${contactId}`);

    // Store meeting data
    // activeCalls.set(contactId, {
    //   connectionData: response.ConnectionData,
    //   createdAt: new Date().toISOString(),
    //   customerJoined: true,
    //   agentJoined: false,
    // });

    // // Notify agents via WebSocket
    // notifyAgents(contactId);

    return Response.json({
      success: true,
      contactId,
      connectionData: {
        Meeting: response.ConnectionData.Meeting,
        Attendee: response.ConnectionData.Attendee,
      },
    });

  } catch (error) {
    console.error('❌ Error starting WebRTC:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

