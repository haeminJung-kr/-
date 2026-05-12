import { universities } from './universities.js';

class DaeMeChu2D {
    constructor() {
        this.canvas = document.getElementById('map-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.card = document.getElementById('uni-card');
        
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
        this.selectedUni = null;
        
        this.init();
    }

    async init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        await this.loadGeoJson();
        this.setupSearch();
        this.animate();
        
        // Initial map centering
        this.centerMap();
    }

    async loadGeoJson() {
        try {
            const response = await fetch('https://raw.githubusercontent.com/southkorea/southkorea-maps/master/gadm/json/skorea-provinces-geo.json');
            this.geoData = await response.json();
        } catch (e) {
            console.error('Failed to load map:', e);
        }
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width * this.pixelRatio;
        this.canvas.height = this.height * this.pixelRatio;
        this.ctx.scale(this.pixelRatio, this.pixelRatio);
        this.centerMap();
    }

    centerMap() {
        // South Korea roughly: Lon [124, 131], Lat [33, 39]
        this.scale = Math.min(this.width, this.height) * 0.15;
        this.targetScale = this.scale;
        this.offsetX = this.width / 2;
        this.offsetY = this.height / 2;
        this.targetOffsetX = this.offsetX;
        this.targetOffsetY = this.offsetY;
    }

    project(lon, lat) {
        // Lon -> X, Lat -> -Y (Canvas Y is down)
        const x = (lon - 127.5) * this.scale + this.offsetX;
        const y = (36 - lat) * this.scale * 1.2 + this.offsetY; // 1.2 aspect correction
        return { x, y };
    }

    animate() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // Smooth lerp for zoom/pan
        this.scale += (this.targetScale - this.scale) * 0.08;
        this.offsetX += (this.targetOffsetX - this.offsetX) * 0.08;
        this.offsetY += (this.targetOffsetY - this.offsetY) * 0.08;

        if (this.geoData) {
            this.drawMap();
        }
        this.drawMarkers();
        
        requestAnimationFrame(() => this.animate());
    }

    drawMap() {
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#e0e0e0';
        this.ctx.lineWidth = 1;
        this.ctx.fillStyle = '#f7f7f7';

        this.geoData.features.forEach(feature => {
            const type = feature.geometry.type;
            const coords = feature.geometry.coordinates;

            if (type === 'Polygon') {
                this.drawPolygon(coords[0]);
            } else if (type === 'MultiPolygon') {
                coords.forEach(poly => this.drawPolygon(poly[0]));
            }
        });
        this.ctx.fill();
        this.ctx.stroke();
    }

    drawPolygon(points) {
        points.forEach((p, i) => {
            const { x, y } = this.project(p[0], p[1]);
            if (i === 0) this.ctx.moveTo(x, y);
            else this.ctx.lineTo(x, y);
        });
    }

    drawMarkers() {
        universities.forEach(uni => {
            const { x, y } = this.project(uni.coords[0], uni.coords[1]);
            
            // Pulse effect
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
            );

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
        this.selectedUni = uni;
        
        // Zoom-in target
        this.targetScale = Math.min(this.width, this.height) * 2;
        
        // Center the selected university
        // The project function uses targetScale/offsetX internally, but we need to calculate
        // where to set targetOffsetX/Y so that (uni.coords) ends up at (width/2, height/2).
        // x = (lon - 127.5) * scale + offsetX => offsetX = x - (lon - 127.5) * scale
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
