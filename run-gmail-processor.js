const GmailProcessor = require('./gmail-processor');

async function runGmailProcessor() {
  try {
    console.log('🚀 Starting Gmail processing...');
    
    const processor = new GmailProcessor();
    const result = await processor.processDaily();
    
    console.log('\n📊 Processing result:');
    console.log('─────────────────────────────────');
    console.log(`✅ Successful: ${result.success}`);
    console.log(`📧 Emails found: ${result.emailsFound || 0}`);
    console.log(`📁 Funds processed: ${result.fondosProcessed || 0}`);
    
    if (result.firebaseResult) {
      console.log(`🔥 Firebase saved: ${result.firebaseResult.success}`);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error in processing:', error.message);
    console.error('Stack trace:', error.stack);
    
    throw error;
  }
}

if (require.main === module) {
  runGmailProcessor()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runGmailProcessor };