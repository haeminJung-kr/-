import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as TWEEN from '@tweenjs/tween.js';
import { universities } from './universities.js';

class DaeMeChuApp {
    constructor() {
        this.container = document.getElementById('map-container');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        
        this.mapGroup = new THREE.Group();
        this.markers = [];
        this.selectedUni = null;

        this.init();
    }

    async init() {
        this.setupRenderer();
        this.setupCamera();
        this.setupLights();
        this.setupControls();
        
        await this.loadMap();
        this.addUniversityMarkers();
        this.setupSearch();
        
        this.animate();
        
        window.addEventListener('resize', () => this.onWindowResize());
    }

    setupRenderer() {
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);
    }

    setupCamera() {
        // Initial view of the Korean Peninsula
        this.camera.position.set(0, -10, 15);
        this.camera.lookAt(0, 0, 0);
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 5, 10);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
    }

    setupControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 50;
    }

    async loadMap() {
        try {
            // Fetch simplified South Korea GeoJSON
            const response = await fetch('https://raw.githubusercontent.com/southkorea/southkorea-maps/master/gadm/json/skorea-provinces-geo.json');
            const data = await response.json();
            this.renderGeoJson(data);
        } catch (error) {
            console.error('Failed to load map data:', error);
            // Fallback: Create a simple plane or a primitive shape representing Korea
            const geometry = new THREE.PlaneGeometry(10, 12);
            const material = new THREE.MeshPhongMaterial({ color: 0xeeeeee, side: THREE.DoubleSide });
            const fallbackMap = new THREE.Mesh(geometry, material);
            this.mapGroup.add(fallbackMap);
        }
        this.scene.add(this.mapGroup);
    }

    renderGeoJson(data) {
        // Simple projection: lon -> x, lat -> y
        // Korea bounds: Lon [124, 131], Lat [33, 39]
        const lonCenter = 127.5;
        const latCenter = 36;
        const scale = 2;

        data.features.forEach(feature => {
            const coordinates = feature.geometry.coordinates;
            const color = new THREE.Color().setHSL(Math.random() * 0.1 + 0.05, 0.8, 0.6); // Food-like warm colors

            if (feature.geometry.type === 'Polygon') {
                this.createPolygonMesh(coordinates, lonCenter, latCenter, scale, color);
            } else if (feature.geometry.type === 'MultiPolygon') {
                coordinates.forEach(polygon => {
                    this.createPolygonMesh(polygon, lonCenter, latCenter, scale, color);
                });
            }
        });

        // Rotate group to face camera better
        this.mapGroup.rotation.x = -Math.PI / 2;
    }

    createPolygonMesh(polygon, lonCenter, latCenter, scale, color) {
        const shape = new THREE.Shape();
        
        polygon[0].forEach((coord, index) => {
            const x = (coord[0] - lonCenter) * scale;
            const y = (coord[1] - latCenter) * scale;
            if (index === 0) shape.moveTo(x, y);
            else shape.lineTo(x, y);
        });

        const extrudeSettings = { depth: 0.2, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05 };
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const material = new THREE.MeshPhongMaterial({ 
            color: 0xffffff, 
            flatShading: true,
            transparent: true,
            opacity: 0.9
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        this.mapGroup.add(mesh);
    }

    addUniversityMarkers() {
        const lonCenter = 127.5;
        const latCenter = 36;
        const scale = 2;

        universities.forEach(uni => {
            const x = (uni.coords[0] - lonCenter) * scale;
            const y = (uni.coords[1] - latCenter) * scale;
            const z = 0.5;

            // Marker Mesh
            const geo = new THREE.CylinderGeometry(0.05, 0, 0.3, 16);
            const mat = new THREE.MeshPhongMaterial({ color: 0xff6b00 });
            const marker = new THREE.Mesh(geo, mat);
            
            marker.position.set(x, y, z);
            marker.rotation.x = Math.PI / 2;
            marker.userData = uni;
            
            this.mapGroup.add(marker);
            this.markers.push(marker);

            // Add glow effect
            const spriteMat = new THREE.SpriteMaterial({
                map: this.createGlowTexture(),
                color: 0xff6b00,
                transparent: true,
                blending: THREE.AdditiveBlending
            });
            const sprite = new THREE.Sprite(spriteMat);
            sprite.scale.set(0.5, 0.5, 0.5);
            marker.add(sprite);
        });
    }

    createGlowTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.2, 'rgba(255,255,255,0.5)');
        gradient.addColorStop(0.5, 'rgba(255,107,0,0.2)');
        gradient.addColorStop(1, 'rgba(255,107,0,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    setupSearch() {
        const input = document.getElementById('uni-search');
        const results = document.getElementById('search-results');

        input.addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
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
                        <span class="result-name">${u.name}</span>
                        <span class="result-region">${u.region}</span>
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
                this.flyToUniversity(uni);
                input.value = name;
                results.classList.add('hidden');
            }
        });
    }

    flyToUniversity(uni) {
        const lonCenter = 127.5;
        const latCenter = 36;
        const scale = 2;

        const targetX = (uni.coords[0] - lonCenter) * scale;
        const targetY = 0.5; // Target height
        const targetZ = -(uni.coords[1] - latCenter) * scale; // Map is rotated -PI/2

        // OrbitControls target change
        new TWEEN.Tween(this.controls.target)
            .to({ x: targetX, y: 0.2, z: targetZ }, 1500)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .start();

        // Camera position change
        new TWEEN.Tween(this.camera.position)
            .to({ x: targetX, y: 3, z: targetZ + 4 }, 2000)
            .easing(TWEEN.Easing.Cubic.InOut)
            .onComplete(() => {
                this.showInfoPanel(uni);
            })
            .start();
    }

    showInfoPanel(uni) {
        const panel = document.getElementById('info-panel');
        document.getElementById('selected-uni-name').textContent = uni.name;
        panel.classList.remove('hidden');
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate(time) {
        requestAnimationFrame((t) => this.animate(t));
        TWEEN.update(time);
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
        
        // Marker animation
        this.markers.forEach(m => {
            m.rotation.y += 0.02;
            const sprite = m.children[0];
            if (sprite) {
                sprite.scale.setScalar(0.4 + Math.sin(Date.now() * 0.005) * 0.1);
            }
        });
    }
}

// Start app
window.addEventListener('DOMContentLoaded', () => {
    new DaeMeChuApp();
});
