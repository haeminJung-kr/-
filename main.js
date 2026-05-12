import { universities } from './universities.js';

class DaeMeChu2D {
    constructor() {
        this.canvas = document.getElementById('map-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.card = document.getElementById('uni-card');
        
        // Offscreen canvas for map pre-rendering
        this.offCanvas = document.createElement('canvas');
        this.offCtx = this.offCanvas.getContext('2d');
        
        this.width = 0;
        this.height = 0;
        this.pixelRatio = window.devicePixelRatio || 1;
        
        // Map state
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.targetScale = 1;
        this.targetOffsetX = 0;
        this.targetOffsetY = 0;
        
        this.geoData = null;
        this.mapDirty = true; // Flag to redraw map to offscreen canvas
        
        this.init();
    }

    async init() {
        this.resize();
        window.addEventListener('resize', () => {
            this.resize();
            this.mapDirty = true;
        });
        
        await this.loadGeoJson();
        this.setupSearch();
        this.animate();
        this.centerMap();
    }

    async loadGeoJson() {
        try {
            const response = await fetch('https://raw.githubusercontent.com/southkorea/southkorea-maps/master/gadm/json/skorea-provinces-geo.json');
            this.geoData = await response.json();
            this.mapDirty = true;
        } catch (e) {
            console.error('Failed to load map:', e);
        }
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        
        const setupCanvas = (canvas) => {
            canvas.width = this.width * this.pixelRatio;
            canvas.height = this.height * this.pixelRatio;
            const ctx = canvas.getContext('2d');
            ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
        };

        setupCanvas(this.canvas);
        setupCanvas(this.offCanvas);
    }

    centerMap() {
        this.scale = Math.min(this.width, this.height) * 0.15;
        this.targetScale = this.scale;
        this.offsetX = this.width / 2;
        this.offsetY = this.height / 2;
        this.targetOffsetX = this.offsetX;
        this.targetOffsetY = this.offsetY;
        this.mapDirty = true;
    }

    project(lon, lat, scale, offsetX, offsetY) {
        const x = (lon - 127.5) * scale + offsetX;
        const y = (36 - lat) * scale * 1.2 + offsetY;
        return { x, y };
    }

    animate() {
        // Smooth lerp
        const ds = (this.targetScale - this.scale) * 0.1;
        const dx = (this.targetOffsetX - this.offsetX) * 0.1;
        const dy = (this.targetOffsetY - this.offsetY) * 0.1;

        if (Math.abs(ds) > 0.001 || Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
            this.scale += ds;
            this.offsetX += dx;
            this.offsetY += dy;
            this.mapDirty = true;
        }

        if (this.mapDirty) {
            this.renderOffscreen();
            this.mapDirty = false;
        }

        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.drawImage(this.offCanvas, 0, 0, this.width, this.height);
        
        this.drawMarkers();
        
        requestAnimationFrame(() => this.animate());
    }

    renderOffscreen() {
        const ctx = this.offCtx;
        ctx.clearRect(0, 0, this.width, this.height);
        
        if (!this.geoData) return;

        ctx.beginPath();
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#f7f7f7';

        this.geoData.features.forEach(feature => {
            const coords = feature.geometry.coordinates;
            if (feature.geometry.type === 'Polygon') {
                this.drawPolygon(ctx, coords[0]);
            } else {
                coords.forEach(poly => this.drawPolygon(ctx, poly[0]));
            }
        });
        ctx.fill();
        ctx.stroke();
    }

    drawPolygon(ctx, points) {
        points.forEach((p, i) => {
            const { x, y } = this.project(p[0], p[1], this.scale, this.offsetX, this.offsetY);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
    }

    drawMarkers() {
        universities.forEach(uni => {
            const { x, y } = this.project(uni.coords[0], uni.coords[1], this.scale, this.offsetX, this.offsetY);
            
            // Pulse (Only markers animate on main canvas for performance)
            const pulse = Math.sin(Date.now() * 0.005) * 2;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, 4 + pulse, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(255, 107, 0, 0.2)';
            this.ctx.fill();

            this.ctx.beginPath();
            this.ctx.arc(x, y, 3, 0, Math.PI * 2);
            this.ctx.fillStyle = '#ff6b00';
            this.ctx.fill();
        });
    }

    setupSearch() {
        const input = document.getElementById('uni-search');
        const results = document.getElementById('search-results');

        input.addEventListener('input', (e) => {
            const val = e.target.value.trim().toLowerCase();
            if (!val) {
                results.classList.add('hidden');
                return;
            }

            const filtered = universities.filter(u => 
                u.name.toLowerCase().includes(val) || 
                u.enName.toLowerCase().includes(val)
            ).slice(0, 10); // Limit search results

            if (filtered.length > 0) {
                results.innerHTML = filtered.map(u => `
                    <div class="result-item" data-name="${u.name}">
                        ${u.name}
                    </div>
                `).join('');
                results.classList.remove('hidden');
            } else {
                results.classList.add('hidden');
            }
        });

        results.addEventListener('click', (e) => {
            const item = e.target.closest('.result-item');
            if (item) {
                const name = item.dataset.name;
                const uni = universities.find(u => u.name === name);
                this.selectUniversity(uni);
                input.value = name;
                results.classList.add('hidden');
            }
        });
    }

    selectUniversity(uni) {
        this.targetScale = Math.min(this.width, this.height) * 2.5;
        this.targetOffsetX = (this.width / 2) - (uni.coords[0] - 127.5) * this.targetScale;
        this.targetOffsetY = (this.height / 2) + (uni.coords[1] - 36) * this.targetScale * 1.2;
        this.showCard(uni);
    }

    showCard(uni) {
        document.getElementById('card-title').textContent = uni.name;
        document.getElementById('card-region').textContent = uni.region;
        this.card.classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new DaeMeChu2D();
});
