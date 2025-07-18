const { runGmailProcessor } = require('./run-gmail-processor');

/**
 * Cloud Function entry point
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.main = async (req, res) => {
	// Configurar CORS para permitir llamadas desde cualquier origen
	res.set('Access-Control-Allow-Origin', '*');
	res.set('Access-Control-Allow-Methods', 'GET, POST');
	res.set('Access-Control-Allow-Headers', 'Content-Type');

	// Manejar preflight requests
	if (req.method === 'OPTIONS') {
		res.status(204).send('');
		return;
	}

	try {
		console.log('🚀 Cloud Function triggered - Starting Gmail processing...');

		// Ejecutar el procesador de Gmail
		const result = await runGmailProcessor();

		console.log('\n📊 Processing result:');
		console.log('─────────────────────────────────');
		console.log(`✅ Successful: ${result.success}`);
		console.log(`📧 Emails found: ${result.emailsFound || 0}`);
		console.log(`📁 Funds processed: ${result.fondosProcessed || 0}`);

		if (result.firebaseResult) {
			console.log(`🔥 Firebase saved: ${result.firebaseResult.success}`);
		}

		// Responder con éxito
		res.status(200).json({
			success: true,
			message: 'Gmail processing completed successfully',
			result: result
		});

	} catch (error) {
		console.error('❌ Error in Cloud Function:', error.message);
		console.error(error.stack);

		// Responder con error
		res.status(500).json({
			success: false,
			message: 'Error processing Gmail',
			error: error.message
		});
	}
};