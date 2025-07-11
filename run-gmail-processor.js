const GmailProcessor = require('./gmail-processor');

async function main() {
  try {
    console.log('🚀 Iniciando procesamiento de Gmail...');
    
    const processor = new GmailProcessor();
    const result = await processor.processDaily();
    
    console.log('\n📊 Resultado del procesamiento:');
    console.log('─────────────────────────────────');
    console.log(`✅ Exitoso: ${result.success}`);
    console.log(`📧 Emails encontrados: ${result.emailsFound || 0}`);
    console.log(`📁 Fondos procesados: ${result.fondosProcessed || 0}`);
    
    if (result.firebaseResult) {
      console.log(`🔥 Firebase guardado: ${result.firebaseResult.success}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en el procesamiento:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar si este archivo es ejecutado directamente
if (require.main === module) {
  main();
} 