const GmailProcessor = require('./gmail-processor');

async function main() {
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
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in processing:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Execute if this file is run directly
if (require.main === module) {
  main();
} 