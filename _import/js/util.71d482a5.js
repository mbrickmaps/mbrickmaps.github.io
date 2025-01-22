const PhotoUtils = {
    // Calculate aspect ratio from image dimensions
    getAspectRatio(width, height) {
      const gcd = this._calculateGCD(width, height);
      return `${width/gcd}:${height/gcd}`;
    },
  
    // Preview crop dimensions for common ratios
    getCropDimensions(img, targetRatio) {
      const currentRatio = img.width / img.height;
      const [targetWidth, targetHeight] = targetRatio.split(':').map(Number);
      const desiredRatio = targetWidth / targetHeight;
      
      let cropWidth, cropHeight;
      
      if (currentRatio > desiredRatio) {
        // Image is wider than target ratio
        cropHeight = img.height;
        cropWidth = img.height * desiredRatio;
      } else {
        // Image is taller than target ratio
        cropWidth = img.width;
        cropHeight = img.width / desiredRatio;
      }
      
      // Calculate centered position
      const x = (img.width - cropWidth) / 2;
      const y = (img.height - cropHeight) / 2;
      
      return {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(cropWidth),
        height: Math.round(cropHeight)
      };
    },
  
    // Draw crop overlay on canvas
    drawCropPreview(img, canvas, ratio) {
      const ctx = canvas.getContext('2d');
      
      // Set canvas size to match image
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw original image
      ctx.drawImage(img, 0, 0);
      
      // Calculate crop dimensions
      const crop = this.getCropDimensions(img, ratio);
      
      // Draw semi-transparent overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Clear crop area
      ctx.clearRect(crop.x, crop.y, crop.width, crop.height);
      
      // Draw crop border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(crop.x, crop.y, crop.width, crop.height);
      
      return crop;
    },
  
    // Common aspect ratios for quick reference
    commonRatios: {
      square: '1:1',
      landscape: '3:2',
      portrait: '2:3',
      widescreen: '16:9',
      instagram: '4:5',
      facebook: '1.91:1'
    },
  
    // Helper function to calculate GCD for aspect ratio
    _calculateGCD(a, b) {
      return b === 0 ? a : this._calculateGCD(b, a % b);
    }
  };
  
  // Usage example:
  /*
  const img = document.querySelector('img');
  const canvas = document.querySelector('canvas');
  
  // Get current aspect ratio
  const ratio = PhotoUtils.getAspectRatio(img.width, img.height);
  console.log(`Current aspect ratio: ${ratio}`);
  
  // Preview 16:9 crop
  PhotoUtils.drawCropPreview(img, canvas, '16:9');
  */
  
  export default PhotoUtils;