// Test sending a WhatsApp message
const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
const phoneNumberId = process.env.META_WHATSAPP_BUSINESS_PHONE_NUMBER_ID;

async function testSendMessage() {
  try {
    console.log('Testing WhatsApp Message Send...');
    
    // Test number (replace with a test number you control)
    const testNumber = '919325025730'; // Indian number format
    
    const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
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
          body: 'Hello! This is a test message from your AI Calling Agent platform.'
        }
      })
    });

    const result = await response.json();
    console.log('Response Status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));

    if (result.error) {
      console.error('Error details:');
      console.error('- Code:', result.error.code);
      console.error('- Type:', result.error.type);
      console.error('- Message:', result.error.message);
      console.error('- Details:', result.error.error_data);
    }
  } catch (error) {
    console.error('Request failed:', error.message);
  }
}

testSendMessage();