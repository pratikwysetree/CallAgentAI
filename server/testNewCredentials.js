// Test the new WhatsApp API credentials
const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
const phoneNumberId = process.env.META_WHATSAPP_BUSINESS_PHONE_NUMBER_ID;
const businessAccountId = process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID;

console.log('Testing new WhatsApp API credentials...');
console.log('Access Token:', accessToken ? `${accessToken.substring(0, 20)}...` : 'NOT SET');
console.log('Phone Number ID:', phoneNumberId || 'NOT SET');
console.log('Business Account ID:', businessAccountId || 'NOT SET');

async function testCredentials() {
  if (!accessToken || !phoneNumberId) {
    console.error('Missing credentials');
    return;
  }

  try {
    // Test phone number info
    console.log('\n1. Testing phone number info...');
    const phoneResponse = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const phoneResult = await phoneResponse.json();
    console.log('Phone Info:', JSON.stringify(phoneResult, null, 2));

    if (phoneResult.error) {
      console.error('Phone number error:', phoneResult.error.message);
      return;
    }

    // Test sending a message to a test number
    console.log('\n2. Testing message send...');
    const testNumber = '919325025730'; // Replace with your test number
    
    const messageResponse = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: testNumber,
        type: 'text',
        text: {
          body: 'Hello! This is a test message from your updated AI Calling Agent platform.'
        }
      })
    });

    const messageResult = await messageResponse.json();
    console.log('Message Response Status:', messageResponse.status);
    console.log('Message Result:', JSON.stringify(messageResult, null, 2));

    if (messageResult.error) {
      console.error('Message send error:');
      console.error('- Code:', messageResult.error.code);
      console.error('- Type:', messageResult.error.type);
      console.error('- Message:', messageResult.error.message);
      
      if (messageResult.error.code === 100) {
        console.log('\nThis error usually means:');
        console.log('1. Phone number not verified for messaging');
        console.log('2. Account in development mode without proper permissions');
        console.log('3. Need to add test numbers to your WhatsApp Business account');
        console.log('4. Account needs to be approved by Meta for production messaging');
      }
    } else {
      console.log('✅ Message sent successfully!');
    }

  } catch (error) {
    console.error('Request failed:', error.message);
  }
}

testCredentials();