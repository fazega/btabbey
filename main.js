import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, monk, controls;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let rotateLeft = false, rotateRight = false;
const speed = 0.1;
const rotationSpeed = 0.03;
const cameraDistance = 5;
const cameraHeight = 2;
const minCameraHeight = 0.5;
const maxCameraHeight = 3.5; // Keep camera below ceiling
const minDistance = 2;
const maxDistance = 8;
const cameraOffset = new THREE.Vector3(0, 2, 5); // Camera's relative position to monk
let candles = [];
let npc;
let time = 0;
let isMouseControlling = false;
let mouseControlTimer = null;
const mouseControlTimeout = 2000; // Time in ms before camera returns to follow mode
let missionPanel = {
    currentMission: "Talk to the monk",
    status: "Not started",
    description: "Approach the other monk to begin your investigation."
};
let interactKeyPressed = false;

// Add these constants at the top with your other constants
const WALL_SIZE = {
    x: 9.5,  // Half width of room minus wall thickness
    z: 9.5   // Half depth of room minus wall thickness
};

// Update these constants at the top
const MIN_CAMERA_DISTANCE = 2;  // Minimum zoom
const MAX_CAMERA_DISTANCE = 6;  // Maximum zoom
let currentCameraDistance = 4;  // Starting distance (you can adjust this)

// Add these variables at the top
let clock = new THREE.Clock();

function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Sky blue

    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 5);

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // Load textures first
    const textures = loadTextures();

    // Add lights
    const topLight = new THREE.DirectionalLight(0xffffff, 0.2);
    topLight.position.set(0, 5, 0);
    topLight.castShadow = false;  // Don't cast shadows from this light
    scene.add(topLight);

    // Very dim ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.05);
    scene.add(ambientLight);

    // Create characters
    monk = createDetailedMonk(false);
    scene.add(monk);

    npc = createDetailedMonk(true);
    scene.add(npc);

    // Create environment with textures
    createFloor(textures);
    createAbbeyWalls(textures);
    createRoof(textures);
    createCandles();

    // Setup camera controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.mouseButtons = {
        RIGHT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,  // This enables zoom with middle mouse/scroll wheel
        LEFT: null
    };
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2;
    controls.minPolarAngle = Math.PI / 6;
    controls.minDistance = MIN_CAMERA_DISTANCE;
    controls.maxDistance = MAX_CAMERA_DISTANCE;
    controls.enablePan = false;
    controls.zoomSpeed = 0.5;  // Adjust this to control zoom sensitivity

    // Event listeners
    window.addEventListener('resize', onWindowResize, false);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // Add these new event listeners
    renderer.domElement.addEventListener('mousedown', (e) => {
        if (e.button === 2) { // Right mouse button
            isMouseControlling = true;
            if (mouseControlTimer) clearTimeout(mouseControlTimer);
        }
    });

    renderer.domElement.addEventListener('mouseup', (e) => {
        if (e.button === 2) { // Right mouse button
            if (mouseControlTimer) clearTimeout(mouseControlTimer);
            mouseControlTimer = setTimeout(() => {
                isMouseControlling = false;
            }, mouseControlTimeout);
        }
    });

    // Add wheel event listener for zoom
    renderer.domElement.addEventListener('wheel', onMouseWheel, false);
}

function loadTextures() {
    const textureLoader = new THREE.TextureLoader();
    
    // Stone floor texture (using a more reliable texture URL)
    const stoneFloorTexture = textureLoader.load('https://threejs.org/examples/textures/brick_diffuse.jpg');
    stoneFloorTexture.wrapS = stoneFloorTexture.wrapT = THREE.RepeatWrapping;
    // Make the stone pattern smaller for floor tiles
    stoneFloorTexture.repeat.set(8, 8);
    
    // Wall textures
    const stoneWallTexture = textureLoader.load('https://threejs.org/examples/textures/brick_diffuse.jpg');
    stoneWallTexture.wrapS = stoneWallTexture.wrapT = THREE.RepeatWrapping;
    stoneWallTexture.repeat.set(4, 2);
    
    // Wood texture for roof
    const woodTexture = textureLoader.load('https://threejs.org/examples/textures/hardwood2_diffuse.jpg');
    const woodNormalMap = textureLoader.load('https://threejs.org/examples/textures/hardwood2_normal.jpg');
    woodTexture.wrapS = woodTexture.wrapT = THREE.RepeatWrapping;
    woodNormalMap.wrapS = woodNormalMap.wrapT = THREE.RepeatWrapping;
    woodTexture.repeat.set(4, 4);
    woodNormalMap.repeat.set(4, 4);
    
    return {
        stoneFloor: {
            map: stoneFloorTexture
        },
        stoneWall: {
            map: stoneWallTexture
        },
        wood: {
            map: woodTexture,
            normalMap: woodNormalMap
        }
    };
}

function createFloor(textures) {
    const floorGeometry = new THREE.PlaneGeometry(20, 20);
    const floorMaterial = new THREE.MeshPhongMaterial({ 
        map: textures.stoneFloor.map,
        side: THREE.DoubleSide,
        color: 0x999999  // Add a slight gray tint
    });
    
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
}

function createAbbeyWalls(textures) {
    const wallMaterial = new THREE.MeshPhongMaterial({ 
        map: textures.stoneWall.map,
        bumpMap: textures.stoneWall.map,
        bumpScale: 0.1,
    });
    
    // Create walls
    const walls = [
        { pos: [0, 2, -10], scale: [20, 4, 0.5] },  // North wall
        { pos: [0, 2, 10], scale: [20, 4, 0.5] },   // South wall
        { pos: [-10, 2, 0], scale: [0.5, 4, 20] },  // West wall
        { pos: [10, 2, 0], scale: [0.5, 4, 20] },   // East wall
    ];

    walls.forEach(wall => {
        const wallGeometry = new THREE.BoxGeometry(1, 1, 1);
        const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
        wallMesh.position.set(...wall.pos);
        wallMesh.scale.set(...wall.scale);
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;
        scene.add(wallMesh);
    });
}

function createCandles() {
    // Add candles around the room
    const candlePositions = [
        new THREE.Vector3(-8, 0, -8),
        new THREE.Vector3(8, 0, -8),
        new THREE.Vector3(-8, 0, 8),
        new THREE.Vector3(8, 0, 8),
        new THREE.Vector3(0, 0, 0)
    ];
    
    candlePositions.forEach(position => createCandle(position));
}

function createCandle(position) {
    const candleGroup = new THREE.Group();
    
    // Candle base
    const candleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.2, 8);
    const candleMaterial = new THREE.MeshPhongMaterial({ color: 0xf4e4bc });
    const candle = new THREE.Mesh(candleGeometry, candleMaterial);
    candle.castShadow = true;
    candle.receiveShadow = true;
    
    // Create multiple flame layers for more realistic effect
    const createFlameLayer = (scale, color, height) => {
        const flameGeo = new THREE.ConeGeometry(0.02 * scale, 0.08 * scale, 8, 1, true);
        const flameMat = new THREE.MeshBasicMaterial({ 
            color: color,
            transparent: true,
            opacity: 0.8
        });
        const flame = new THREE.Mesh(flameGeo, flameMat);
        flame.position.y = 0.2 + height;
        return flame;
    };

    // Create multiple flame layers
    const innerFlame = createFlameLayer(0.8, 0xffff00, 0); // Yellow inner
    const middleFlame = createFlameLayer(1.0, 0xff9933, -0.01); // Orange middle
    const outerFlame = createFlameLayer(1.2, 0xff3300, -0.02); // Red outer
    
    const flames = [innerFlame, middleFlame, outerFlame];
    flames.forEach(flame => candleGroup.add(flame));
    
    // Much brighter flickering light
    const light = new THREE.PointLight(0xff9933, 5, 10); // Increased intensity and range
    light.position.y = 0.3;
    light.castShadow = true;
    light.shadow.mapSize.width = 512;
    light.shadow.mapSize.height = 512;
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 4.0;
    light.shadow.bias = -0.001;
    
    candleGroup.add(candle);
    candleGroup.add(light);
    candleGroup.position.copy(position);
    
    // Store flame references for animation
    candles.push({ 
        group: candleGroup, 
        light: light, 
        flames: flames 
    });
    scene.add(candleGroup);
}

function createDetailedMonk(isNPC = false) {
    const monkGroup = new THREE.Group();

    // Robe (main body)
    const robeGeometry = new THREE.CylinderGeometry(0.3, 0.4, 1.5, 8);
    const robeMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x4b3621,
        roughness: 0.7
    });
    const robe = new THREE.Mesh(robeGeometry, robeMaterial);
    robe.position.y = 0.75;
    robe.castShadow = true;
    robe.receiveShadow = true;
    monkGroup.add(robe);

    // Hood
    const hoodGeometry = new THREE.SphereGeometry(0.25, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const hood = new THREE.Mesh(hoodGeometry, robeMaterial);
    hood.position.y = 1.6;
    hood.castShadow = true;
    hood.receiveShadow = true;
    monkGroup.add(hood);

    // Head
    const headGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const skinMaterial = new THREE.MeshPhongMaterial({ color: 0xe6c8a0 });
    const head = new THREE.Mesh(headGeometry, skinMaterial);
    head.position.y = 1.5;
    head.castShadow = true;
    head.receiveShadow = true;
    monkGroup.add(head);

    // Arms - pointing downward
    const armGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8);
    const leftArm = new THREE.Mesh(armGeometry, robeMaterial);
    leftArm.position.set(0.35, 0.9, 0);
    leftArm.rotation.z = Math.PI;
    leftArm.castShadow = false;  // Don't cast shadows from arms
    leftArm.receiveShadow = true;
    monkGroup.add(leftArm);

    const rightArm = new THREE.Mesh(armGeometry, robeMaterial);
    rightArm.position.set(-0.35, 0.9, 0);
    rightArm.rotation.z = Math.PI;
    rightArm.castShadow = false;  // Don't cast shadows from arms
    rightArm.receiveShadow = true;
    monkGroup.add(rightArm);

    // Add rope belt
    const beltGeometry = new THREE.TorusGeometry(0.35, 0.03, 8, 16);
    const beltMaterial = new THREE.MeshPhongMaterial({ color: 0x8b4513 });
    const belt = new THREE.Mesh(beltGeometry, beltMaterial);
    belt.position.y = 0.9;
    belt.rotation.x = Math.PI / 2;
    belt.castShadow = false;  // Don't cast shadows from belt
    belt.receiveShadow = true;
    monkGroup.add(belt);

    // Position the entire monk
    if (isNPC) {
        monkGroup.position.set(3, 0, -3);
        monkGroup.rotation.y = Math.PI / 4;
    }

    return monkGroup;
}

function createRoof(textures) {
    // Main roof structure
    const roofGeometry = new THREE.BoxGeometry(21, 0.2, 21);
    const woodMaterial = new THREE.MeshPhongMaterial({ 
        map: textures.wood.map,
        color: 0x8B4513,  // Adjusted color for better visibility
        shininess: 0,     // Make it less shiny
        reflectivity: 0   // Reduce reflectivity
    });
    
    const roof = new THREE.Mesh(roofGeometry, woodMaterial);
    roof.position.y = 4;
    roof.receiveShadow = true;
    roof.castShadow = false;
    scene.add(roof);
    
    // Add wooden beams
    const beamGeometry = new THREE.BoxGeometry(0.3, 0.3, 20);
    for (let i = -9; i <= 9; i += 3) {
        const beam = new THREE.Mesh(beamGeometry, woodMaterial);
        beam.position.set(i, 3.8, 0);
        beam.castShadow = false;
        beam.receiveShadow = true;
        scene.add(beam);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
    // Prevent default behavior for these keys
    if (['z', 'q', 's', 'd', 'a', 'e'].includes(event.key.toLowerCase())) {
        event.preventDefault();
    }

    switch(event.key.toLowerCase()) { // Convert to lowercase to handle both cases
        case 'z': moveForward = true; break;
        case 's': moveBackward = true; break;
        case 'q': moveLeft = true; break;
        case 'd': moveRight = true; break;
        case 'a': rotateLeft = true; break;
        case 'e': 
            interactKeyPressed = true;
            break;
    }
}

function onKeyUp(event) {
    switch(event.key.toLowerCase()) {
        case 'z': moveForward = false; break;
        case 's': moveBackward = false; break;
        case 'q': moveLeft = false; break;
        case 'd': moveRight = false; break;
        case 'a': rotateLeft = false; break;
        case 'e':
            interactKeyPressed = false;
            break;
    }
}

function onMouseWheel(event) {
    // Update currentCameraDistance based on wheel direction
    if (event.deltaY < 0) {
        currentCameraDistance = Math.max(MIN_CAMERA_DISTANCE, currentCameraDistance - 0.2);
    } else {
        currentCameraDistance = Math.min(MAX_CAMERA_DISTANCE, currentCameraDistance + 0.2);
    }
}

function updateMonkPosition() {
    // Calculate movement direction based on camera view
    const moveDirection = new THREE.Vector3(0, 0, 0);
    
    if (moveForward || moveBackward || moveLeft || moveRight) {
        // Get camera's forward direction (excluding y component)
        const cameraForward = new THREE.Vector3();
        camera.getWorldDirection(cameraForward);
        cameraForward.y = 0;
        cameraForward.normalize();

        // Get camera's right direction
        const cameraRight = new THREE.Vector3();
        cameraRight.crossVectors(cameraForward, new THREE.Vector3(0, 1, 0));

        // Add movement based on camera direction
        if (moveForward) moveDirection.add(cameraForward);
        if (moveBackward) moveDirection.sub(cameraForward);
        if (moveLeft) moveDirection.sub(cameraRight);
        if (moveRight) moveDirection.add(cameraRight);

        // Normalize and apply movement
        if (moveDirection.length() > 0) {
            moveDirection.normalize();
            monk.position.add(moveDirection.multiplyScalar(speed));

            // Update monk's rotation to face movement direction
            if (moveForward || moveBackward || moveLeft || moveRight) {
                const targetRotation = Math.atan2(moveDirection.x, moveDirection.z);
                monk.rotation.y = targetRotation;
            }
        }
    }

    // Clamp monk position within walls
    monk.position.x = Math.max(-WALL_SIZE.x, Math.min(WALL_SIZE.x, monk.position.x));
    monk.position.z = Math.max(-WALL_SIZE.z, Math.min(WALL_SIZE.z, monk.position.z));

    // Update camera position and controls
    controls.target.set(
        monk.position.x,
        monk.position.y + 1,
        monk.position.z
    );

    if (!isMouseControlling) {
        const idealOffset = new THREE.Vector3(
            -currentCameraDistance * Math.sin(monk.rotation.y),
            cameraHeight,
            -currentCameraDistance * Math.cos(monk.rotation.y)
        );
        
        camera.position.lerp(monk.position.clone().add(idealOffset), 0.1);
    } else {
        // When using mouse control, maintain current distance
        const directionToCamera = new THREE.Vector3().subVectors(camera.position, controls.target);
        directionToCamera.normalize();
        camera.position.copy(controls.target).add(directionToCamera.multiplyScalar(currentCameraDistance));
    }

    // Clamp camera position within walls
    camera.position.x = Math.max(-WALL_SIZE.x, Math.min(WALL_SIZE.x, camera.position.x));
    camera.position.z = Math.max(-WALL_SIZE.z, Math.min(WALL_SIZE.z, camera.position.z));
    camera.position.y = Math.max(minCameraHeight, Math.min(maxCameraHeight, camera.position.y));

    controls.update();
}

function updateQuestPanel(title, status, description) {
    document.getElementById('quest-title').textContent = title;
    document.getElementById('quest-status').textContent = status;
    document.getElementById('quest-description').textContent = description;
}

function checkNPCInteraction() {
    const distanceToNPC = monk.position.distanceTo(npc.position);
    
    if (distanceToNPC < 2) { // Within 2 units of the NPC
        updateQuestPanel(
            "Talk to the monk",
            "In range - Press E to talk",
            "Approach the other monk to begin your investigation."
        );
        
        // Check for interaction key (E)
        if (interactKeyPressed) {
            updateQuestPanel(
                "The Bishop's Disappearance",
                "In Progress",
                "The monk tells you about strange occurrences in the abbey's crypt before the bishop's disappearance..."
            );
            // You could trigger a dialogue system here
        }
    } else if (document.getElementById('quest-status').textContent === "In range - Press E to talk") {
        updateQuestPanel(
            "Talk to the monk",
            "Not started",
            "Approach the other monk to begin your investigation."
        );
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    const time = clock.getElapsedTime();
    
    // Animate candles
    candles.forEach(candle => {
        // Animate each flame layer
        candle.flames.forEach((flame, index) => {
            // Different frequencies for each layer
            const freq = 3 + index;
            const amp = 0.1 + (index * 0.05);
            
            // Random fluctuations
            flame.scale.x = 1 + Math.sin(time * freq) * amp;
            flame.scale.z = 1 + Math.cos(time * freq) * amp;
            flame.rotation.y = Math.sin(time * freq * 0.5) * 0.1;
            
            // Vary opacity slightly
            flame.material.opacity = 0.7 + Math.sin(time * freq) * 0.3;
        });

        // Animate light intensity
        const flickerSpeed = 10;
        const flickerIntensity = 0.2;
        candle.light.intensity = 5 + Math.sin(time * flickerSpeed) * flickerIntensity;
    });

    updateMonkPosition();
    controls.update();
    checkNPCInteraction();
    renderer.render(scene, camera);
}

init();
animate();
