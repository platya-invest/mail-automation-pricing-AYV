const { runGmailProcessor } = require('./run-gmail-processor');

/**
 * Cloud Function entry point for Gen2
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.main = async (req, res) => {
	res.set('Access-Control-Allow-Origin', '*');
	res.set('Access-Control-Allow-Methods', 'GET, POST');
	res.set('Access-Control-Allow-Headers', 'Content-Type');

	if (req.method === 'OPTIONS') {
		res.status(204).send('');
		return;
	}

    if (req.query.diagnose === 'true') {
		

        return res.status(200).json({
			success: true,
			message: 'Diagnóstico de variables de entorno',
			diagnosis: diagnosis
		});
	}

    if (req.query.diagnose === 'openai') {
        try {
            const { runGmailProcessor } = require('./run-gmail-processor');
            const GmailProcessor = require('./gmail-processor');
            const processor = new GmailProcessor();
            const test = await processor.openaiProcessor.testConnectivity();
            return res.status(200).json({ success: true, test });
        } catch (error) {
            return res.status(500).json({ success: false, error: error?.message || 'Unknown error' });
        }
    }

	try {
		console.log('🚀 Cloud Function triggered - Starting Gmail processing...');

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
		console.error('Stack trace:', error.stack);
		
		const errorResponse = {
			success: false,
			message: 'Error processing Gmail',
			error: error.message,
			timestamp: new Date().toISOString(),
			errorType: error.name || 'UnknownError'
		};

		res.status(500).json(errorResponse);
	}
};