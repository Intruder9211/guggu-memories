import crypto from 'crypto';

export default async function handler(req, res) {
  // CORS configuration or standard Vercel Headers
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { public_id, resource_type = 'image' } = req.body;

  if (!public_id) {
    return res.status(400).json({ error: 'Missing public_id parameter' });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(500).json({ 
      error: 'Cloudinary server-side credentials are not fully configured' 
    });
  }

  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    
    // Cloudinary requires signature parameters sorted alphabetically
    // We sign: public_id and timestamp
    const signatureStr = `public_id=${public_id}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(signatureStr).digest('hex');

    const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resource_type}/destroy`;
    
    console.log(`Attempting to delete Cloudinary asset with public_id: ${public_id}, resource_type: ${resource_type}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        public_id,
        timestamp,
        api_key: apiKey,
        signature,
      }),
    });

    const data = await response.json();
    console.log('Cloudinary response:', data);

    if (data.result === 'ok') {
      return res.status(200).json({ success: true, result: data.result });
    } else {
      return res.status(400).json({ 
        success: false, 
        error: data.error?.message || data.result || 'Cloudinary deletion failed' 
      });
    }
  } catch (error) {
    console.error('Error during Cloudinary deletion serverless execution:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
