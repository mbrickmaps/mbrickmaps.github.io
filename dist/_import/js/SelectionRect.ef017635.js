// SelectionRect.js
export class SelectionRect {
    static DEFAULT_STYLES = {
        strokeColor: '#00ff00',
        fillColor: 'rgba(0, 255, 0, 0.1)',
        handleColor: '#ffffff',
        handleSize: 8,
        handleStroke: '#000000',
        borderWidth: 2
    };

    static HANDLE_POSITIONS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.style = { ...SelectionRect.DEFAULT_STYLES, ...options };
        this.initializeState();
        this.bindEvents();
    }

    initializeState() {
        this.rect = {
            x: 0,
            y: 0,
            width: 100,
            height: 100
        };
    
        this.interaction = {
            isDragging: false,
            isResizing: false,
            activeHandle: null,
            dragOffset: { x: 0, y: 0 },
            aspectRatio: null  // Add this for aspect ratio locking
        };
    }

    lockAspectRatio(enable = true) {
        if (enable) {
            this.interaction.aspectRatio = this.rect.width / this.rect.height;
        } else {
            this.interaction.aspectRatio = null;
        }
    }

    setSelection(x, y, width, height) {
        this.rect = { x, y, width, height };
        this.constrainToBounds();
        this.draw();
    }

    getHandles() {
        const { x, y, width, height } = this.rect;
        const h = this.style.handleSize;
        
        return {
            'nw': { x: x - h/2, y: y - h/2 },
            'n':  { x: x + width/2 - h/2, y: y - h/2 },
            'ne': { x: x + width - h/2, y: y - h/2 },
            'e':  { x: x + width - h/2, y: y + height/2 - h/2 },
            'se': { x: x + width - h/2, y: y + height - h/2 },
            's':  { x: x + width/2 - h/2, y: y + height - h/2 },
            'sw': { x: x - h/2, y: y + height - h/2 },
            'w':  { x: x - h/2, y: y + height/2 - h/2 }
        };
    }

    bindEvents() {
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);

        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
    }

    destroy() {
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
    }

    handleMouseDown(e) {
        const { x, y } = this.getMousePosition(e);
        const handles = this.getHandles();

        // Check handles first
        for (let position of SelectionRect.HANDLE_POSITIONS) {
            const handle = handles[position];
            if (this.isOverHandle(x, y, handle)) {
                this.interaction.isResizing = true;
                this.interaction.activeHandle = position;
                return;
            }
        }

        // Check if clicking inside rectangle
        if (this.isOverRect(x, y)) {
            this.interaction.isDragging = true;
            this.interaction.dragOffset = {
                x: x - this.rect.x,
                y: y - this.rect.y
            };
        }
    }

    handleMouseMove(e) {
        const { x, y } = this.getMousePosition(e);

        if (this.interaction.isDragging) {
            this.updateDragPosition(x, y);
        } else if (this.interaction.isResizing) {
            this.updateResizePosition(x, y);
        }
    }

    handleMouseUp() {
        this.interaction.isDragging = false;
        this.interaction.isResizing = false;
        this.interaction.activeHandle = null;
    }

    getMousePosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    updateDragPosition(x, y) {
        this.rect.x = x - this.interaction.dragOffset.x;
        this.rect.y = y - this.interaction.dragOffset.y;
        this.constrainToBounds();
        this.draw();
    }

    updateResizePosition(x, y) {
        const original = { ...this.rect };
        const handle = this.interaction.activeHandle;
    
        switch(handle) {
            case 'nw':
                this.rect.width += this.rect.x - x;
                this.rect.height += this.rect.y - y;
                this.rect.x = x;
                this.rect.y = y;
                break;
            case 'n':
                this.rect.height += this.rect.y - y;
                this.rect.y = y;
                break;
            case 'ne':
                this.rect.width = x - this.rect.x;
                this.rect.height += this.rect.y - y;
                this.rect.y = y;
                break;
            case 'e':
                this.rect.width = x - this.rect.x;
                break;
            case 'se':
                this.rect.width = x - this.rect.x;
                this.rect.height = y - this.rect.y;
                break;
            case 's':
                this.rect.height = y - this.rect.y;
                break;
            case 'sw':
                this.rect.width += this.rect.x - x;
                this.rect.height = y - this.rect.y;
                this.rect.x = x;
                break;
            case 'w':
                this.rect.width += this.rect.x - x;
                this.rect.x = x;
                break;
        }

        if (this.interaction.aspectRatio !== null) {
            // Maintain aspect ratio based on width
            const newHeight = this.rect.width / this.interaction.aspectRatio;
            // Adjust height and y position based on handle
            if (['n', 'ne', 'nw'].includes(handle)) {
                this.rect.y += this.rect.height - newHeight;
            }
            this.rect.height = newHeight;
        }
        
        if (this.rect.width < 20 || this.rect.height < 20) {
            Object.assign(this.rect, original);
        }

        this.constrainToBounds(); // Add this
        this.draw();
    }

    constrainToBounds() {
        const bounds = {
            x: 0,
            y: 0,
            width: this.canvas.width,
            height: this.canvas.height
        };
    
        // Constrain position
        this.rect.x = Math.max(0, Math.min(this.rect.x, bounds.width - this.rect.width));
        this.rect.y = Math.max(0, Math.min(this.rect.y, bounds.height - this.rect.height));
    
        // Constrain size
        this.rect.width = Math.min(this.rect.width, bounds.width - this.rect.x);
        this.rect.height = Math.min(this.rect.height, bounds.height - this.rect.y);
    }

    isOverHandle(x, y, handle) {
        const h = this.style.handleSize;
        return x >= handle.x && x <= handle.x + h &&
               y >= handle.y && y <= handle.y + h;
    }

    isOverRect(x, y) {
        return x >= this.rect.x && x <= this.rect.x + this.rect.width &&
               y >= this.rect.y && y <= this.rect.y + this.rect.height;
    }

    draw() {
        // Clear and draw
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawSelectionRect();
        this.drawHandles();
    }

    drawSelectionRect() {
        const { strokeColor, fillColor, borderWidth } = this.style;
        this.ctx.strokeStyle = strokeColor;
        this.ctx.fillStyle = fillColor;
        this.ctx.lineWidth = borderWidth;
        
        this.ctx.fillRect(
            this.rect.x, this.rect.y,
            this.rect.width, this.rect.height
        );
        this.ctx.strokeRect(
            this.rect.x, this.rect.y,
            this.rect.width, this.rect.height
        );
    }

    drawHandles() {
        const handles = this.getHandles();
        const { handleColor, handleStroke, handleSize } = this.style;

        for (let position of SelectionRect.HANDLE_POSITIONS) {
            const { x, y } = handles[position];
            
            this.ctx.fillStyle = handleColor;
            this.ctx.strokeStyle = handleStroke;
            this.ctx.lineWidth = 1;
            
            this.ctx.fillRect(x, y, handleSize, handleSize);
            this.ctx.strokeRect(x, y, handleSize, handleSize);
        }
    }

    getSelection() {
        return { ...this.rect };
    }
}