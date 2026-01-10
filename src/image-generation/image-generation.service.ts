import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class ImageGenerationService {
  private readonly logger = new Logger(ImageGenerationService.name);
  private httpClient: AxiosInstance;
  private apiKey: string;
  private baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('NANO_BANANA_API_KEY') || '';
    this.baseUrl = this.configService.get<string>('NANO_BANANA_BASE_URL') || 'https://api.nanobanana.ai';

    if (!this.apiKey) {
      this.logger.warn('NANO_BANANA_API_KEY not found. Image generation will not work.');
    }

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000, // 60 seconds timeout for image generation
    });
  }

  /**
   * Generate initial image from text (Node 0)
   * Pure Text-to-Image generation
   */
  async generateImage(prompt: string): Promise<string> {
    this.logger.log('Generating initial image from text prompt');
    
    try {
      const response = await this.httpClient.post('/generate', {
        prompt,
        aspect_ratio: '1:1',
        num_inference_steps: 30,
        guidance_scale: 7.5,
      });

      // Assuming the API returns { image_url: "..." }
      const imageUrl = response.data.image_url || response.data.url;
      
      if (!imageUrl) {
        throw new Error('No image URL returned from Nano Banana API');
      }

      this.logger.log('Image generated successfully');
      return imageUrl;
    } catch (error) {
      this.logger.error(`Image generation failed: ${error.message}`);
      throw new Error('Failed to generate image from text prompt');
    }
  }

  /**
   * Edit existing image based on new prompt (Node 1+)
   * Image-to-Image / Edit mode for character consistency
   */
  async editImage(
    previousImageUrl: string,
    prompt: string,
    strength: number = 0.65,
  ): Promise<string> {
    this.logger.log('Editing image to maintain character consistency');
    
    try {
      // Download the previous image first
      const imageResponse = await axios.get(previousImageUrl, {
        responseType: 'arraybuffer',
      });
      const imageBuffer = Buffer.from(imageResponse.data);
      const imageBase64 = imageBuffer.toString('base64');

      const response = await this.httpClient.post('/edit', {
        image: imageBase64,
        prompt,
        strength, // 0.6-0.7 balance between consistency and prompt adherence
        guidance_scale: 7.5,
        num_inference_steps: 30,
      });

      const imageUrl = response.data.image_url || response.data.url;
      
      if (!imageUrl) {
        throw new Error('No image URL returned from Nano Banana API');
      }

      this.logger.log('Image edited successfully');
      return imageUrl;
    } catch (error) {
      this.logger.error(`Image editing failed: ${error.message}`);
      
      // Fallback: Generate new image if editing fails
      this.logger.warn('Falling back to text-to-image generation');
      return this.generateImage(prompt);
    }
  }

  /**
   * Alternative: Image-to-Image using a reference image
   * This method downloads the image, converts to base64, and sends to API
   */
  async imageToImage(
    previousImageUrl: string,
    prompt: string,
    strength: number = 0.65,
  ): Promise<string> {
    this.logger.log('Converting image-to-image with new prompt');
    
    try {
      const imageResponse = await axios.get(previousImageUrl, {
        responseType: 'arraybuffer',
      });
      const imageBuffer = Buffer.from(imageResponse.data);
      const imageBase64 = imageBuffer.toString('base64');

      const response = await this.httpClient.post('/image-to-image', {
        image: imageBase64,
        prompt,
        strength,
        guidance_scale: 7.5,
        num_inference_steps: 30,
      });

      const imageUrl = response.data.image_url || response.data.url;
      
      if (!imageUrl) {
        throw new Error('No image URL returned from Nano Banana API');
      }

      this.logger.log('Image-to-image conversion successful');
      return imageUrl;
    } catch (error) {
      this.logger.error(`Image-to-image failed: ${error.message}`);
      throw new Error('Failed to convert image-to-image');
    }
  }
}
