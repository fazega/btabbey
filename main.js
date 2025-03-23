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
let altarNPC;  // New NPC in the altar room
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
let hasTalkedToMonk = false;  // Add this flag to track if player has talked to the monk
let hasTalkedToAltarNPC = false;  // New flag for altar NPC interaction
let interactKeyWasPressed = false;

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

// Add these variables at the top with other state variables
let isDoorOpen = false;
let doorRotation = 0;
const DOOR_ROTATION_SPEED = 0.05;  // Reduced from 0.1 for smoother animation
const MAX_DOOR_ROTATION = Math.PI / 2;
let doorTargetRotation = 0;  // New variable to track target rotation

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
    createAltarRoom(textures);  // Add the new altar room
    createAltarRoomFloor(textures);  // Add the altar room floor

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
    
    // Create walls with doorway in east wall
    const walls = [
        { pos: [0, 2, -10], scale: [20, 4, 0.5] },  // North wall
        { pos: [0, 2, 10], scale: [20, 4, 0.5] },   // South wall
        { pos: [-10, 2, 0], scale: [0.5, 4, 20] },  // West wall
    ];

    // Add the east wall with a doorway
    // Left section of east wall (from -10 to -0.65)
    const leftWallGeometry = new THREE.BoxGeometry(1, 1, 1);
    const leftWallMesh = new THREE.Mesh(leftWallGeometry, wallMaterial);
    leftWallMesh.position.set(10, 2, -5.325);
    leftWallMesh.scale.set(0.5, 4, 9.35);
    leftWallMesh.castShadow = true;
    leftWallMesh.receiveShadow = true;
    scene.add(leftWallMesh);

    // Right section of east wall (from 0.65 to 10)
    const rightWallGeometry = new THREE.BoxGeometry(1, 1, 1);
    const rightWallMesh = new THREE.Mesh(rightWallGeometry, wallMaterial);
    rightWallMesh.position.set(10, 2, 5.325);
    rightWallMesh.scale.set(0.5, 4, 9.35);
    rightWallMesh.castShadow = true;
    rightWallMesh.receiveShadow = true;
    scene.add(rightWallMesh);

    // Top section of east wall (above doorway)
    const topWallGeometry = new THREE.BoxGeometry(1, 1, 1);
    const topWallMesh = new THREE.Mesh(topWallGeometry, wallMaterial);
    topWallMesh.position.set(10, 3, 0);
    topWallMesh.scale.set(0.5, 2, 20);
    topWallMesh.castShadow = true;
    topWallMesh.receiveShadow = true;
    scene.add(topWallMesh);

    // Add the other walls
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

function createBigCandle(position) {
    const candleGroup = new THREE.Group();
    
    // Bigger candle base
    const candleGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.4, 12);
    const candleMaterial = new THREE.MeshPhongMaterial({ color: 0xf4e4bc });
    const candle = new THREE.Mesh(candleGeometry, candleMaterial);
    candle.castShadow = true;
    candle.receiveShadow = true;
    
    // Create multiple flame layers for more realistic effect
    const createFlameLayer = (scale, color, height) => {
        const flameGeo = new THREE.ConeGeometry(0.03 * scale, 0.12 * scale, 12, 1, true);
        const flameMat = new THREE.MeshBasicMaterial({ 
            color: color,
            transparent: true,
            opacity: 0.8
        });
        const flame = new THREE.Mesh(flameGeo, flameMat);
        flame.position.y = 0.4 + height;
        return flame;
    };

    // Create multiple flame layers
    const innerFlame = createFlameLayer(1.2, 0xffff00, 0); // Yellow inner
    const middleFlame = createFlameLayer(1.4, 0xff9933, -0.01); // Orange middle
    const outerFlame = createFlameLayer(1.6, 0xff3300, -0.02); // Red outer
    
    const flames = [innerFlame, middleFlame, outerFlame];
    flames.forEach(flame => candleGroup.add(flame));
    
    // Much brighter flickering light
    const light = new THREE.PointLight(0xff9933, 8, 15); // Increased intensity and range
    light.position.y = 0.5;
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

function createDetailedMonk(isNPC = false, isAltarNPC = false) {
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
    
    // Add wooden beams for main room
    const beamGeometry = new THREE.BoxGeometry(0.3, 0.3, 20);
    for (let i = -9; i <= 9; i += 3) {
        const beam = new THREE.Mesh(beamGeometry, woodMaterial);
        beam.position.set(i, 3.8, 0);
        beam.castShadow = false;
        beam.receiveShadow = true;
        scene.add(beam);
    }

    // Add altar room roof
    const altarRoofGeometry = new THREE.BoxGeometry(11, 0.2, 11);
    const altarRoof = new THREE.Mesh(altarRoofGeometry, woodMaterial);
    altarRoof.position.set(15, 4, 0);  // Positioned above altar room
    altarRoof.receiveShadow = true;
    altarRoof.castShadow = false;
    scene.add(altarRoof);

    // Add wooden beams for altar room
    const altarBeamGeometry = new THREE.BoxGeometry(0.3, 0.3, 10);
    for (let i = 10; i <= 20; i += 3) {
        const beam = new THREE.Mesh(altarBeamGeometry, woodMaterial);
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

    // Check if we're in the doorway area
    const isNearDoor = Math.abs(monk.position.z) < 1 && Math.abs(monk.position.x - 10) < 1;
    
    // Apply wall constraints based on whether we're in the doorway and if the door is open
    if (isNearDoor && isDoorOpen) {
        // When in doorway and door is open, only constrain y position
        monk.position.y = Math.max(0, Math.min(4, monk.position.y));
    } else {
        // Normal wall constraints
        if (monk.position.x > 10) {
            // In altar room
            monk.position.x = Math.max(10, Math.min(20, monk.position.x));
            monk.position.z = Math.max(-5, Math.min(5, monk.position.z));
        } else {
            // In main room
            monk.position.x = Math.max(-WALL_SIZE.x, Math.min(WALL_SIZE.x, monk.position.x));
            monk.position.z = Math.max(-WALL_SIZE.z, Math.min(WALL_SIZE.z, monk.position.z));
        }
        monk.position.y = Math.max(0, Math.min(4, monk.position.y));
    }

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
    if (monk.position.x > 10) {
        // In altar room - smooth transition
        const targetX = Math.max(10, Math.min(20, camera.position.x));
        const targetZ = Math.max(-5, Math.min(5, camera.position.z));
        
        // Smoothly interpolate camera position
        camera.position.x += (targetX - camera.position.x) * 0.1;
        camera.position.z += (targetZ - camera.position.z) * 0.1;
    } else {
        // In main room - smooth transition
        const targetX = Math.max(-WALL_SIZE.x, Math.min(WALL_SIZE.x, camera.position.x));
        const targetZ = Math.max(-WALL_SIZE.z, Math.min(WALL_SIZE.z, camera.position.z));
        
        // Smoothly interpolate camera position
        camera.position.x += (targetX - camera.position.x) * 0.1;
        camera.position.z += (targetZ - camera.position.z) * 0.1;
    }
    camera.position.y = Math.max(minCameraHeight, Math.min(maxCameraHeight, camera.position.y));

    controls.update();
}

function updateQuestPanel(title, status, description) {
    document.getElementById('quest-title').textContent = title;
    const statusElement = document.getElementById('quest-status');
    statusElement.textContent = status;
    
    // Set the appropriate data-status attribute
    if (status === "Not started") {
        statusElement.removeAttribute('data-status');
    } else if (status === "In Progress") {
        statusElement.setAttribute('data-status', 'in-progress');
    } else if (status === "Completed") {
        statusElement.setAttribute('data-status', 'completed');
    }
    
    document.getElementById('quest-description').textContent = description;
}

function checkNPCInteraction() {
    const distanceToNPC = monk.position.distanceTo(npc.position);
    const distanceToAltarNPC = monk.position.distanceTo(altarNPC.position);
    const distanceToDoor = Math.abs(monk.position.z) < 1 && Math.abs(monk.position.x - 10) < 1;
    
    if (distanceToDoor) {
        updateQuestPanel(
            "Door",
            isDoorOpen ? "Open" : "Closed",
            "Press E to " + (isDoorOpen ? "close" : "open") + " the door"
        );
        
        if (interactKeyPressed && !interactKeyWasPressed) {  // Only trigger once when E is first pressed
            isDoorOpen = !isDoorOpen;
            doorTargetRotation = isDoorOpen ? MAX_DOOR_ROTATION : 0;
        }
    } else if (distanceToNPC < 2) { // Within 2 units of the first NPC
        if (!hasTalkedToMonk) {
            updateQuestPanel(
                "Talk to the monk",
                "In range - Press E to talk",
                "Approach the other monk to begin your investigation."
            );
            
            if (interactKeyPressed) {
                hasTalkedToMonk = true;
                updateQuestPanel(
                    "The Bishop's Disappearance",
                    "In Progress",
                    "The monk tells you about strange occurrences in the abbey's crypt before the bishop's disappearance..."
                );
                showDialog();
            }
        }
    } else if (distanceToAltarNPC < 2) { // Within 2 units of the altar NPC
        if (!hasTalkedToAltarNPC) {
            updateQuestPanel(
                "Talk to the altar keeper",
                "In range - Press E to talk",
                "The altar keeper might know something about the bishop's disappearance."
            );
            
            if (interactKeyPressed) {
                hasTalkedToAltarNPC = true;
                updateQuestPanel(
                    "The Bishop's Disappearance",
                    "In Progress",
                    "The altar keeper tells you about strange symbols he found in the bishop's private chapel..."
                );
                showAltarDialog();
            }
        }
    } else if (!hasTalkedToMonk && document.getElementById('quest-status').textContent === "In range - Press E to talk") {
        updateQuestPanel(
            "Talk to the monk",
            "Not started",
            "Approach the other monk to begin your investigation."
        );
    }
    
    // Store the current state of the interact key for next frame
    interactKeyWasPressed = interactKeyPressed;
}

function showDialog() {
    const dialogWindow = document.getElementById('dialog-window');
    dialogWindow.classList.remove('hidden');
    
    // Add event listener for close button
    document.getElementById('close-dialog').addEventListener('click', () => {
        dialogWindow.classList.add('hidden');
    });
}

function showAltarDialog() {
    const dialogWindow = document.getElementById('dialog-window');
    dialogWindow.classList.remove('hidden');
    
    // Update dialog content for altar NPC
    document.querySelector('.dialog-content h2').textContent = 'Brother Marcus';
    document.querySelector('.dialog-text').innerHTML = `
        <p>Ah, you're investigating the bishop's disappearance. I've been tending to this altar for many years, and I've seen many things.</p>
        <p>The bishop often came here to pray, especially in the early hours of the morning. He was particularly interested in the ancient symbols carved into the altar's base.</p>
        <p>One night, I saw him speaking with the master mason here. They were arguing about something - something about the cathedral's true purpose. The bishop mentioned something about "the old ways" and "forbidden knowledge."</p>
        <p>After that night, I found strange markings on the altar - symbols I've never seen before. They look ancient, possibly from before the time of Christ.</p>
    `;
    
    // Add event listener for close button
    document.getElementById('close-dialog').addEventListener('click', () => {
        dialogWindow.classList.add('hidden');
    });
}

function createAltarRoom(textures) {
    // Create altar room walls (smaller room adjacent to main room)
    const altarWallMaterial = new THREE.MeshPhongMaterial({ 
        map: textures.stoneWall.map,
        bumpMap: textures.stoneWall.map,
        bumpScale: 0.1,
    });

    // Create altar room walls - positioned to the right of the main room
    const altarWalls = [
        { pos: [15, 2, -5], scale: [10, 4, 0.5] },  // North wall
        { pos: [15, 2, 5], scale: [10, 4, 0.5] },   // South wall
        { pos: [20, 2, 0], scale: [0.5, 4, 10] },   // East wall
    ];

    // Add the connecting wall with a doorway
    // Left section of connecting wall
    const leftWallGeometry = new THREE.BoxGeometry(1, 1, 1);
    const leftWallMesh = new THREE.Mesh(leftWallGeometry, altarWallMaterial);
    leftWallMesh.position.set(10, 2, -4);
    leftWallMesh.scale.set(0.5, 4, 6);
    leftWallMesh.castShadow = true;
    leftWallMesh.receiveShadow = true;
    scene.add(leftWallMesh);

    // Right section of connecting wall
    const rightWallGeometry = new THREE.BoxGeometry(1, 1, 1);
    const rightWallMesh = new THREE.Mesh(rightWallGeometry, altarWallMaterial);
    rightWallMesh.position.set(10, 2, 4);
    rightWallMesh.scale.set(0.5, 4, 6);
    rightWallMesh.castShadow = true;
    rightWallMesh.receiveShadow = true;
    scene.add(rightWallMesh);

    // Top section of connecting wall
    const topWallGeometry = new THREE.BoxGeometry(1, 1, 1);
    const topWallMesh = new THREE.Mesh(topWallGeometry, altarWallMaterial);
    topWallMesh.position.set(10, 3, 0);
    topWallMesh.scale.set(0.5, 2, 10);
    topWallMesh.castShadow = true;
    topWallMesh.receiveShadow = true;
    scene.add(topWallMesh);

    // Add the other walls
    altarWalls.forEach(wall => {
        const wallGeometry = new THREE.BoxGeometry(1, 1, 1);
        const wallMesh = new THREE.Mesh(wallGeometry, altarWallMaterial);
        wallMesh.position.set(...wall.pos);
        wallMesh.scale.set(...wall.scale);
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;
        scene.add(wallMesh);
    });

    // Create door group for proper edge rotation
    const doorGroup = new THREE.Group();
    doorGroup.position.set(10, 1, 0);  // Position the group at the door's pivot point

    // Create door (make it thicker and more visible)
    const doorGeometry = new THREE.BoxGeometry(1.3, 2, 0.1);  // Width: 1.3 (half of 2.6), Height: 2 (full height)
    const doorMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x8B4513,
        shininess: 30
    });
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.set(0, 0, 0.65);  // Position door relative to the group (half its width to the right)
    door.castShadow = true;
    door.receiveShadow = true;
    doorGroup.add(door);

    // Store door group reference for animation
    window.door = doorGroup;
    scene.add(doorGroup);

    // Create altar
    const altarGeometry = new THREE.BoxGeometry(2, 1, 1);
    const altarMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x8B4513,
        roughness: 0.8,
        metalness: 0.2
    });
    const altar = new THREE.Mesh(altarGeometry, altarMaterial);
    altar.position.set(15, 0.5, -3);
    altar.castShadow = true;
    altar.receiveShadow = true;
    scene.add(altar);

    // Add altar decorations
    const crossGeometry = new THREE.BoxGeometry(0.1, 0.8, 0.1);
    const crossMaterial = new THREE.MeshPhongMaterial({ color: 0xFFD700 });
    const cross = new THREE.Mesh(crossGeometry, crossMaterial);
    cross.position.set(15, 1.2, -3);
    cross.castShadow = true;
    cross.receiveShadow = true;
    scene.add(cross);

    // Add big candlesticks on altar
    const bigCandlestickPositions = [
        new THREE.Vector3(14.2, 0.5, -3),
        new THREE.Vector3(15.8, 0.5, -3)
    ];
    bigCandlestickPositions.forEach(pos => createBigCandle(pos));

    // Create altar NPC (smaller monk)
    altarNPC = createDetailedMonk(true);
    altarNPC.position.set(15, 0, -2);
    altarNPC.rotation.y = Math.PI;
    altarNPC.scale.set(0.8, 0.8, 0.8);  // Make the NPC smaller
    scene.add(altarNPC);
}

function createAltarRoomFloor(textures) {
    // Create altar room floor (smaller than main room)
    const altarFloorGeometry = new THREE.PlaneGeometry(10, 10);
    const altarFloorMaterial = new THREE.MeshPhongMaterial({ 
        map: textures.stoneFloor.map,
        side: THREE.DoubleSide,
        color: 0x999999
    });
    
    const altarFloor = new THREE.Mesh(altarFloorGeometry, altarFloorMaterial);
    altarFloor.rotation.x = Math.PI / 2;
    altarFloor.position.set(15, 0, 0);  // Positioned in the altar room
    altarFloor.receiveShadow = true;
    scene.add(altarFloor);
}

function animate() {
    requestAnimationFrame(animate);
    
    const time = clock.getElapsedTime();
    
    // Animate door with smooth interpolation
    if (window.door) {
        // Smoothly interpolate current rotation towards target
        doorRotation += (doorTargetRotation - doorRotation) * DOOR_ROTATION_SPEED;
        
        // Apply the rotation around the door's edge (the group's position)
        window.door.rotation.y = doorRotation;
    }
    
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
