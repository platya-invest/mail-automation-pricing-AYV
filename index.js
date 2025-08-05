const { runGmailProcessor } = require('./run-gmail-processor');

/**
 * Cloud Function entry point for Gen2
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

	// Endpoint de diagnóstico
	if (req.query.diagnose === 'true') {
		console.log('🔍 === DIAGNÓSTICO DE VARIABLES DE ENTORNO ===');
		
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

		const firebaseVars = [
			'FIREBASE_PROJECT_ID',
			'FIREBASE_PRIVATE_KEY_ID',
			'FIREBASE_PRIVATE_KEY',
			'FIREBASE_CLIENT_EMAIL',
			'FIREBASE_CLIENT_ID'
		];

		const diagnosis = {
			timestamp: new Date().toISOString(),
			auth: {},
			openai: {},
			firebase: {},
			other: {}
		};

		// Variables de autenticación
		for (const envVar of authVars) {
			const value = process.env[envVar];
			diagnosis.auth[envVar] = value || 'NO CONFIGURADA';
		}

		// Variables de OpenAI
		diagnosis.openai.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'NO CONFIGURADA';

		// Variables de Firebase
		for (const envVar of firebaseVars) {
			const value = process.env[envVar];
			diagnosis.firebase[envVar] = value || 'NO CONFIGURADA';
		}

		// Variables adicionales
		diagnosis.other.NODE_ENV = process.env.NODE_ENV || 'No configurado';
		diagnosis.other.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'No configurado';

		return res.status(200).json({
			success: true,
			message: 'Diagnóstico de variables de entorno',
			diagnosis: diagnosis
		});
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
		console.error('Stack trace:', error.stack);

		// Mostrar todas las variables de entorno cuando hay error
		console.log('\n🔍 === DIAGNÓSTICO DE VARIABLES DE ENTORNO EN CLOUD FUNCTION ===');
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

		// Preparar respuesta de error con información detallada
		const errorResponse = {
			success: false,
			message: 'Error processing Gmail',
			error: error.message,
			timestamp: new Date().toISOString(),
			errorType: error.name || 'UnknownError'
		};

		// Si tenemos información adicional del error, incluirla
		if (error.errorInfo) {
			errorResponse.details = error.errorInfo;
		}

		// Si es un error de autenticación, agregar sugerencias
		if (error.message.includes('invalid_client') || error.message.includes('invalid_grant')) {
			errorResponse.authError = true;
			errorResponse.suggestions = [
				'Verificar que las variables de entorno estén configuradas correctamente',
				'Verificar que los tokens OAuth2 no hayan expirado',
				'Verificar que las credenciales de Google Cloud estén correctas',
				'Revisar los logs de la Cloud Function para más detalles'
			];
		}

		// Agregar diagnóstico de variables de entorno a la respuesta
		const envDiagnosis = {
			auth: {},
			openai: {},
			firebase: {},
			other: {}
		};

		// Variables de autenticación
		for (const envVar of authVars) {
			const value = process.env[envVar];
			envDiagnosis.auth[envVar] = value || 'NO CONFIGURADA';
		}

		// Variables de OpenAI
		envDiagnosis.openai.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'NO CONFIGURADA';

		// Variables de Firebase
		for (const envVar of firebaseVars) {
			const value = process.env[envVar];
			envDiagnosis.firebase[envVar] = value || 'NO CONFIGURADA';
		}

		// Variables adicionales
		envDiagnosis.other.NODE_ENV = process.env.NODE_ENV || 'No configurado';
		envDiagnosis.other.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'No configurado';

		// Agregar el diagnóstico a la respuesta
		errorResponse.environmentVariables = envDiagnosis;

		// Responder con error detallado
		res.status(500).json(errorResponse);
	}
};