// src/CanvasSystem/CanvasTransformManager.js
export class CanvasTransformManager {
    constructor() {
        this.canvases = new Map();
        this.relationships = new Map();
        this.transformStates = new Map();
    }

    registerCanvas(id, canvas) {
        this.canvases.set(id, canvas);
        this.transformStates.set(id, {
            rotation: 0,
            flipX: false,
            flipY: false,
            scale: 1,
            offsetX: 0,
            offsetY: 0
        });
    }

    copyRegion(sourceId, targetId, {
        sourceX, 
        sourceY, 
        sourceWidth, 
        sourceHeight,
        targetX = 0, 
        targetY = 0, 
        targetWidth, 
        targetHeight,
        applyTransforms = true
    }) {
        const source = this.canvases.get(sourceId);
        const target = this.canvases.get(targetId);
        
        if (!source || !target) {
            throw new Error('Source or target canvas not found');
        }

        // Create temporary canvas for transformations
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = sourceWidth;
        tempCanvas.height = sourceHeight;
        const tempCtx = tempCanvas.getContext('2d');

        // Copy source region to temp canvas
        tempCtx.drawImage(
            source,
            sourceX, sourceY, sourceWidth, sourceHeight,
            0, 0, sourceWidth, sourceHeight
        );

        const targetCtx = target.getContext('2d');
        
        if (applyTransforms) {
            targetCtx.save();
            
            // Get transform state
            const transforms = this.transformStates.get(targetId);
            
            // Set transform origin to target center
            const centerX = targetX + (targetWidth || sourceWidth) / 2;
            const centerY = targetY + (targetHeight || sourceHeight) / 2;
            
            targetCtx.translate(centerX, centerY);
            
            // Apply rotation
            if (transforms.rotation) {
                targetCtx.rotate((transforms.rotation * Math.PI) / 180);
            }
            
            // Apply flips
            targetCtx.scale(
                transforms.flipX ? -1 : 1,
                transforms.flipY ? -1 : 1
            );
            
            targetCtx.translate(-centerX, -centerY);
        }

        // Draw to target with potential scaling
        targetCtx.drawImage(
            tempCanvas,
            0, 0, sourceWidth, sourceHeight,
            targetX, targetY, 
            targetWidth || sourceWidth, 
            targetHeight || sourceHeight
        );

        if (applyTransforms) {
            targetCtx.restore();
        }

        // Track relationship for potential updates
        this.relationships.set(`${sourceId}-${targetId}`, {
            sourceRegion: { x: sourceX, y: sourceY, width: sourceWidth, height: sourceHeight },
            targetRegion: { x: targetX, y: targetY, width: targetWidth, height: targetHeight }
        });
    }

    rotate(canvasId, degrees) {
        const transforms = this.transformStates.get(canvasId);
        if (transforms) {
            transforms.rotation = (transforms.rotation + degrees) % 360;
            this.applyTransforms(canvasId);
        }
    }

    setRotation(canvasId, degrees) {
        const transforms = this.transformStates.get(canvasId);
        if (transforms) {
            transforms.rotation = degrees % 360;
            this.applyTransforms(canvasId);
        }
    }

    flip(canvasId, axis) {
        const transforms = this.transformStates.get(canvasId);
        if (transforms) {
            if (axis === 'x') transforms.flipX = !transforms.flipX;
            if (axis === 'y') transforms.flipY = !transforms.flipY;
            this.applyTransforms(canvasId);
        }
    }

    scale(canvasId, scale) {
        if (scale <= 0) throw new Error('Scale must be positive')
        const transforms = this.transformStates.get(canvasId);
        if (transforms) {
            transforms.scale = scale;
            this.applyTransforms(canvasId);
        }
    }

    hasTransforms(canvasId) {
        const transforms = this.transformStates.get(canvasId);
        if (!transforms) return false;
        
        return transforms.rotation !== 0 
            || transforms.flipX 
            || transforms.flipY 
            || transforms.scale !== 1 
            || transforms.offsetX !== 0 
            || transforms.offsetY !== 0;
    }

    resetTransforms(canvasId) {
        const transforms = this.transformStates.get(canvasId);
        if (transforms) {
            transforms.rotation = 0;
            transforms.flipX = false;
            transforms.flipY = false;
            transforms.scale = 1;
            transforms.offsetX = 0;
            transforms.offsetY = 0;
            this.applyTransforms(canvasId);
        }
    }

    applyTransforms(canvasId) {
        const canvas = this.canvases.get(canvasId);
        const transforms = this.transformStates.get(canvasId);
        
        if (!canvas || !transforms) return;

        const ctx = canvas.getContext('2d');
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        
        // Copy original content to temp canvas
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(canvas, 0, 0);
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Apply transforms
        ctx.save();
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        ctx.translate(centerX + transforms.offsetX, centerY + transforms.offsetY);
        ctx.rotate((transforms.rotation * Math.PI) / 180);
        ctx.scale(
            transforms.scale * (transforms.flipX ? -1 : 1),
            transforms.scale * (transforms.flipY ? -1 : 1)
        );
        ctx.translate(-centerX, -centerY);
        
        // Draw transformed content
        ctx.drawImage(tempCanvas, 0, 0);
        
        ctx.restore();
    }

    // Get current transform state
    getTransforms(canvasId) {
        return { ...this.transformStates.get(canvasId) };
    }

    // Update relationships
    updateRelationships(sourceId) {
        for (const [key, relationship] of this.relationships.entries()) {
            if (key.startsWith(`${sourceId}-`)) {
                const [, targetId] = key.split('-');
                this.copyRegion(sourceId, targetId, {
                    ...relationship.sourceRegion,
                    ...relationship.targetRegion
                });
            }
        }
    }
}