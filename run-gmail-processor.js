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
    
    // Mostrar todas las variables de entorno cuando hay error
    console.log('\n🔍 === DIAGNÓSTICO DE VARIABLES DE ENTORNO EN ERROR ===');
    console.log('📋 Variables de entorno disponibles:');
    
    // List all environment variables related to authentication
    const authVars = [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET', 
      'GOOGLE_REDIRECT_URI',
      'ACCESS_TOKEN_KEY',
      'REFRESH_TOKEN_KEY',
      'SCOPE_KEY',
      'TOKEN_TYPE_KEY',
      'EXPIRY_DATE_KEY'
    ];

    console.log('\n🔐 Variables de autenticación Gmail:');
    for (const envVar of authVars) {
      const value = process.env[envVar];
      if (value) {
        console.log(`✅ ${envVar}: ${value}`);
      } else {
        console.log(`❌ ${envVar}: NO CONFIGURADA`);
      }
    }

    console.log('\n🤖 Variables de OpenAI:');
    console.log(`OPENAI_API_KEY: ${process.env.OPENAI_API_KEY || 'NO CONFIGURADA'}`);

    console.log('\n🔥 Variables de Firebase:');
    const firebaseVars = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_PRIVATE_KEY_ID',
      'FIREBASE_PRIVATE_KEY',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_CLIENT_ID'
    ];
    
    for (const envVar of firebaseVars) {
      const value = process.env[envVar];
      if (value) {
        console.log(`✅ ${envVar}: ${value}`);
      } else {
        console.log(`❌ ${envVar}: NO CONFIGURADA`);
      }
    }

    console.log('\n📊 Variables adicionales:');
    console.log(`NODE_ENV: ${process.env.NODE_ENV || 'No configurado'}`);
    console.log(`GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS || 'No configurado'}`);
    
    console.log('🔍 === FIN DIAGNÓSTICO ===\n');
    
    throw error;
  }
}

// Execute if this file is run directly
if (require.main === module) {
  runGmailProcessor()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runGmailProcessor };