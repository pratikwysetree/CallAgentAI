// Test script to verify WhatsApp API credentials
const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
const phoneNumberId = process.env.META_WHATSAPP_BUSINESS_PHONE_NUMBER_ID;
const businessAccountId = process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID;

console.log('Testing WhatsApp API configuration...');
console.log('Access Token:', accessToken ? `${accessToken.substring(0, 20)}...` : 'NOT SET');
console.log('Phone Number ID:', phoneNumberId || 'NOT SET');
console.log('Business Account ID:', businessAccountId || 'NOT SET');

// Test API endpoint to verify phone number
async function testPhoneNumber() {
  if (!accessToken || !phoneNumberId) {
    console.error('Missing credentials');
    return;
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const result = await response.json();
    console.log('Phone Number Info:', JSON.stringify(result, null, 2));

    if (result.error) {
      console.error('Error:', result.error.message);
      console.log('This usually means:');
      console.log('1. Invalid Phone Number ID');
      console.log('2. Invalid Access Token');
      console.log('3. Phone number not verified');
      console.log('4. Missing permissions');
    }
  } catch (error) {
    console.error('Request failed:', error.message);
  }
}

testPhoneNumber();