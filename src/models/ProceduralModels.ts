import * as THREE from 'three';

export class ProceduralModels {
  // Share materials to save memory and drawcalls
  private static materials: Record<string, THREE.Material> = {};

  private static getMaterial(name: string, config: THREE.MeshStandardMaterialParameters): THREE.Material {
    if (!this.materials[name]) {
      this.materials[name] = new THREE.MeshStandardMaterial(config);
    }
    return this.materials[name];
  }

  // --- CROP MODELS ---
  public static createCropModel(cropType: string, stage: number): THREE.Group {
    const group = new THREE.Group();
    group.name = `crop-${cropType}-${stage}`;

    // Common materials
    const greenMat = this.getMaterial('green', { color: 0x2e7d32, roughness: 0.8, flatShading: true });
    const wheatGoldMat = this.getMaterial('wheatGold', { color: 0xeab308, roughness: 0.7, flatShading: true });
    const carrotOrangeMat = this.getMaterial('carrotOrange', { color: 0xe65100, roughness: 0.8, flatShading: true });
    const tomatoRedMat = this.getMaterial('tomatoRed', { color: 0xd32f2f, roughness: 0.5, metalness: 0.1 });
    const pumpkinOrangeMat = this.getMaterial('pumpkinOrange', { color: 0xf97316, roughness: 0.8, flatShading: true });
    const seedBrownMat = this.getMaterial('seedBrown', { color: 0x78350f, roughness: 0.9 });

    // Stage 0: Seed / Sproutling
    if (stage === 0) {
      // Tiny soil mound with small seed dot
      const seedGeom = new THREE.DodecahedronGeometry(0.12, 0);
      const seedMesh = new THREE.Mesh(seedGeom, seedBrownMat);
      seedMesh.position.y = 0.05;
      group.add(seedMesh);

      // Tiny green sprout leaves
      const leafGeom = new THREE.ConeGeometry(0.08, 0.25, 4);
      const leaf1 = new THREE.Mesh(leafGeom, greenMat);
      leaf1.position.set(-0.05, 0.1, 0);
      leaf1.rotation.z = 0.3;
      
      const leaf2 = new THREE.Mesh(leafGeom, greenMat);
      leaf2.position.set(0.05, 0.1, 0);
      leaf2.rotation.z = -0.3;

      group.add(leaf1, leaf2);
      return group;
    }

    // Stage 1: Medium Sprout
    if (stage === 1) {
      const stemGeom = new THREE.CylinderGeometry(0.05, 0.08, 0.5, 5);
      const stem = new THREE.Mesh(stemGeom, greenMat);
      stem.position.y = 0.25;
      group.add(stem);

      const leafGeom = new THREE.ConeGeometry(0.15, 0.4, 5);
      const leaf = new THREE.Mesh(leafGeom, greenMat);
      leaf.position.y = 0.45;
      group.add(leaf);
      
      group.scale.set(1.2, 1.2, 1.2);
      return group;
    }

    // Stage 2: Growing
    if (stage === 2) {
      // General growing structure
      const stemGeom = new THREE.CylinderGeometry(0.07, 0.1, 0.9, 6);
      const stem = new THREE.Mesh(stemGeom, greenMat);
      stem.position.y = 0.45;
      group.add(stem);

      // Add partial feature
      if (cropType === 'wheat') {
        // Multi-head wheat spikes (still green-yellow)
        const spikeMat = this.getMaterial('greenishYellow', { color: 0x84cc16, roughness: 0.8 });
        const spikeGeom = new THREE.SphereGeometry(0.15, 5, 5);
        for (let i = 0; i < 3; i++) {
          const spike = new THREE.Mesh(spikeGeom, spikeMat);
          spike.position.set(0, 0.6 + i * 0.2, 0);
          spike.scale.set(0.7, 1.3, 0.7);
          group.add(spike);
        }
      } else if (cropType === 'carrot') {
        // Show carrot crown
        const crownGeom = new THREE.CylinderGeometry(0.18, 0.05, 0.4, 6);
        const crown = new THREE.Mesh(crownGeom, carrotOrangeMat);
        crown.position.y = 0.15;
        group.add(crown);
        
        // Leaves bushier
        const leafGeom = new THREE.ConeGeometry(0.2, 0.6, 6);
        const leaves = new THREE.Mesh(leafGeom, greenMat);
        leaves.position.y = 0.5;
        group.add(leaves);
      } else if (cropType === 'tomato') {
        // Tomato vine with tiny green spheres
        const unripeMat = this.getMaterial('unripeGreen', { color: 0x84cc16, roughness: 0.6 });
        const tomatoGeom = new THREE.SphereGeometry(0.12, 6, 6);
        for (let i = 0; i < 2; i++) {
          const tom = new THREE.Mesh(tomatoGeom, unripeMat);
          tom.position.set(Math.sin(i) * 0.25, 0.5 + i * 0.2, Math.cos(i) * 0.25);
          group.add(tom);
        }
      } else if (cropType === 'sunflower') {
        const headGeom = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 8);
        const head = new THREE.Mesh(headGeom, greenMat);
        head.position.set(0, 0.9, 0.1);
        head.rotation.x = Math.PI / 4;
        group.add(head);
      } else if (cropType === 'pumpkin') {
        const pumpGeom = new THREE.DodecahedronGeometry(0.4, 1);
        const pump = new THREE.Mesh(pumpGeom, this.getMaterial('greenishOrange', { color: 0xb45309, roughness: 0.8 }));
        pump.position.set(0.1, 0.2, -0.1);
        group.add(pump);
      }

      return group;
    }

    // Stage 3: Mature (Fully Grown & Harvestable)
    if (stage === 3) {
      if (cropType === 'wheat') {
        // Golden Wheat Stalks
        const stemGeom = new THREE.CylinderGeometry(0.04, 0.06, 1.2, 5);
        const mainStem = new THREE.Mesh(stemGeom, wheatGoldMat);
        mainStem.position.y = 0.6;
        mainStem.castShadow = true;
        group.add(mainStem);

        // Golden spike ears
        const earGeom = new THREE.ConeGeometry(0.15, 0.4, 5);
        for (let i = 0; i < 3; i++) {
          const ear = new THREE.Mesh(earGeom, wheatGoldMat);
          ear.position.set(0, 0.8 + i * 0.2, 0);
          ear.rotation.y = i * Math.PI / 3;
          ear.castShadow = true;
          group.add(ear);
        }
        
        // Sway animation offset
        group.userData = { sway: true, swaySpeed: 1.5, swayAmount: 0.08 };
      } 
      else if (cropType === 'carrot') {
        // Orange root poking out of soil
        const rootGeom = new THREE.CylinderGeometry(0.25, 0.05, 0.6, 8);
        const root = new THREE.Mesh(rootGeom, carrotOrangeMat);
        root.position.y = 0.1; // partial expose
        root.castShadow = true;
        root.receiveShadow = true;
        group.add(root);

        // Green leaves coming out
        const leavesGroup = new THREE.Group();
        leavesGroup.position.set(0, 0.4, 0);
        const leafGeom = new THREE.ConeGeometry(0.15, 0.7, 5);
        
        for (let i = 0; i < 3; i++) {
          const leaf = new THREE.Mesh(leafGeom, greenMat);
          leaf.position.set(Math.cos(i * Math.PI * 0.66) * 0.1, 0.3, Math.sin(i * Math.PI * 0.66) * 0.1);
          leaf.rotation.x = 0.2;
          leaf.rotation.y = i * Math.PI * 0.66;
          leaf.castShadow = true;
          leavesGroup.add(leaf);
        }
        group.add(leavesGroup);
      } 
      else if (cropType === 'tomato') {
        // Sturdy tomato trellis structure
        const woodMat = this.getMaterial('wood', { color: 0x78350f, roughness: 0.9 });
        const postGeom = new THREE.CylinderGeometry(0.04, 0.04, 1.4, 4);
        const post = new THREE.Mesh(postGeom, woodMat);
        post.position.set(0, 0.7, 0);
        post.castShadow = true;
        group.add(post);

        // Green leafy branch structure
        const vineGeom = new THREE.CylinderGeometry(0.05, 0.07, 1.3, 5);
        const vine = new THREE.Mesh(vineGeom, greenMat);
        vine.position.set(0, 0.65, 0.05);
        vine.rotation.z = 0.1;
        group.add(vine);

        // Bright red hanging spheres
        const tomatoGeom = new THREE.SphereGeometry(0.18, 12, 12);
        const tomPositions = [
          new THREE.Vector3(-0.25, 0.9, 0.1),
          new THREE.Vector3(0.25, 0.7, 0.15),
          new THREE.Vector3(-0.15, 0.45, -0.2),
          new THREE.Vector3(0.2, 0.5, -0.1)
        ];

        tomPositions.forEach(pos => {
          const tomato = new THREE.Mesh(tomatoGeom, tomatoRedMat);
          tomato.position.copy(pos);
          tomato.castShadow = true;
          group.add(tomato);

          // Little green cap (sepals)
          const capGeom = new THREE.ConeGeometry(0.08, 0.06, 5);
          const cap = new THREE.Mesh(capGeom, greenMat);
          cap.position.set(pos.x, pos.y + 0.17, pos.z);
          cap.rotation.x = Math.PI;
          group.add(cap);
        });
      } 
      else if (cropType === 'sunflower') {
        const lotusGroup = new THREE.Group();
        
        // Define materials
        const leafPadGreen = this.getMaterial('lotusLeafPad', { color: 0x38a169, roughness: 0.75 });
        const lotusPink = this.getMaterial('lotusPink', { color: 0xf472b6, roughness: 0.6, flatShading: true });
        const lotusDarkPink = this.getMaterial('lotusDarkPink', { color: 0xdb2777, roughness: 0.65, flatShading: true });
        const lotusYellow = this.getMaterial('lotusYellow', { color: 0xeab308, roughness: 0.5 });
        
        // Flower 1: Main larger lotus (centered slightly front-left)
        const f1 = new THREE.Group();
        f1.position.set(-0.25, 0, -0.15);
        
        // Stem
        const stem1 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.1, 5), greenMat);
        stem1.position.y = 0.55;
        stem1.rotation.z = -0.05;
        stem1.castShadow = true;
        f1.add(stem1);
        
        // Lotus Pad (Leaf) resting at bottom
        const pad1 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.02, 12), leafPadGreen);
        pad1.position.set(-0.15, 0.05, 0.1);
        pad1.rotation.set(0.05, 0, -0.05);
        pad1.scale.set(1.0, 1.0, 0.8);
        pad1.receiveShadow = true;
        pad1.castShadow = true;
        f1.add(pad1);
        
        // Flower Head Group
        const head1 = new THREE.Group();
        head1.position.set(-0.02, 1.1, 0);
        head1.rotation.x = Math.PI / 7; // Tilt forward to face camera
        
        // Green Calyx base
        const calyx1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.05, 0.1, 8), greenMat);
        calyx1.position.y = -0.05;
        head1.add(calyx1);
        
        // Petal Geometry template (pointing up along Y)
        const petal1Geom = new THREE.BoxGeometry(0.08, 0.32, 0.02);
        petal1Geom.translate(0, 0.16, 0); // pivot at base
        
        // Outer Petals (8)
        for (let i = 0; i < 8; i++) {
          const petal = new THREE.Mesh(petal1Geom, lotusDarkPink);
          const angle = i * (Math.PI * 2 / 8);
          petal.position.set(Math.cos(angle) * 0.1, 0, Math.sin(angle) * 0.1);
          petal.rotation.y = -angle;
          petal.rotation.x = -0.5; // flare outwards/upwards
          petal.castShadow = true;
          head1.add(petal);
        }
        
        // Inner Petals (6)
        const innerPetalGeom = new THREE.BoxGeometry(0.07, 0.26, 0.015);
        innerPetalGeom.translate(0, 0.13, 0);
        for (let i = 0; i < 6; i++) {
          const petal = new THREE.Mesh(innerPetalGeom, lotusPink);
          const angle = (i + 0.5) * (Math.PI * 2 / 6);
          petal.position.set(Math.cos(angle) * 0.06, 0.04, Math.sin(angle) * 0.06);
          petal.rotation.y = -angle;
          petal.rotation.x = -0.25; // tilt inwards more
          petal.castShadow = true;
          head1.add(petal);
        }
        
        // Yellow core center
        const core1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 8), lotusYellow);
        core1.position.y = 0.06;
        head1.add(core1);
        
        f1.add(head1);
        lotusGroup.add(f1);
        
        // Flower 2: Secondary smaller lotus (centered slightly back-right)
        const f2 = new THREE.Group();
        f2.position.set(0.3, 0, 0.25);
        f2.scale.set(0.75, 0.75, 0.75); // 75% scale
        
        // Stem
        const stem2 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.9, 5), greenMat);
        stem2.position.y = 0.45;
        stem2.rotation.z = 0.06;
        stem2.castShadow = true;
        f2.add(stem2);
        
        // Lotus Pad (Leaf)
        const pad2 = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.02, 12), leafPadGreen);
        pad2.position.set(0.12, 0.04, -0.05);
        pad2.rotation.set(-0.04, 0, 0.04);
        pad2.scale.set(1.0, 1.0, 0.8);
        pad2.receiveShadow = true;
        pad2.castShadow = true;
        f2.add(pad2);
        
        // Flower Head Group
        const head2 = new THREE.Group();
        head2.position.set(0.02, 0.9, 0);
        head2.rotation.x = Math.PI / 8;
        
        // Calyx
        const calyx2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.04, 0.08, 8), greenMat);
        calyx2.position.y = -0.04;
        head2.add(calyx2);
        
        // Outer Petals (6)
        for (let i = 0; i < 6; i++) {
          const petal = new THREE.Mesh(petal1Geom, lotusDarkPink);
          const angle = i * (Math.PI * 2 / 6);
          petal.position.set(Math.cos(angle) * 0.08, 0, Math.sin(angle) * 0.08);
          petal.rotation.y = -angle;
          petal.rotation.x = -0.55;
          petal.castShadow = true;
          head2.add(petal);
        }
        
        // Yellow core
        const core2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8), lotusYellow);
        core2.position.y = 0.05;
        head2.add(core2);
        
        f2.add(head2);
        lotusGroup.add(f2);
        
        group.add(lotusGroup);
        group.userData = { sway: true, swaySpeed: 0.9, swayAmount: 0.04 };
      } 
      else if (cropType === 'pumpkin') {
        // Massive orange pumpkin resting on ground
        const pumpGroup = new THREE.Group();
        pumpGroup.position.set(0, 0.35, 0);

        // Segmented look by combining multiple scaled spheres
        const segGeom = new THREE.SphereGeometry(0.5, 12, 12);
        
        for (let i = 0; i < 4; i++) {
          const seg = new THREE.Mesh(segGeom, pumpkinOrangeMat);
          seg.rotation.y = i * (Math.PI / 4);
          seg.scale.set(1.1, 0.95, 0.85); // flatten and squeeze
          seg.castShadow = true;
          seg.receiveShadow = true;
          pumpGroup.add(seg);
        }

        // Green pumpkin stem
        const stemGeom = new THREE.CylinderGeometry(0.06, 0.08, 0.25, 6);
        const stem = new THREE.Mesh(stemGeom, greenMat);
        stem.position.y = 0.48;
        stem.rotation.z = 0.2;
        stem.castShadow = true;
        pumpGroup.add(stem);

        group.add(pumpGroup);
        // Pumpkin is heavy, scales slightly bouncy
        group.scale.set(1.1, 1.1, 1.1);
      }
    }

    return group;
  }

  // --- STRUCTURES & AUTOMATION ---
  public static createWellModel(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'well';

    const stoneMat = this.getMaterial('stone', { color: 0x64748b, roughness: 0.85 });
    const woodMat = this.getMaterial('woodDark', { color: 0x451a03, roughness: 0.9 });
    const roofMat = this.getMaterial('roofRed', { color: 0x991b1b, roughness: 0.85, flatShading: true });
    const waterMat = this.getMaterial('wellWater', { color: 0x0284c7, roughness: 0.3, metalness: 0.8 });

    // Brick base
    const baseGeom = new THREE.CylinderGeometry(1.4, 1.5, 1.2, 12);
    const base = new THREE.Mesh(baseGeom, stoneMat);
    base.position.y = 0.6;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // Well water inside
    const waterGeom = new THREE.CylinderGeometry(1.2, 1.2, 0.1, 12);
    const water = new THREE.Mesh(waterGeom, waterMat);
    water.position.y = 1.05;
    group.add(water);

    // Support pillars (wood)
    const postGeom = new THREE.CylinderGeometry(0.1, 0.1, 2.0, 4);
    const leftPost = new THREE.Mesh(postGeom, woodMat);
    leftPost.position.set(-1.1, 1.6, 0);
    leftPost.castShadow = true;
    
    const rightPost = leftPost.clone();
    rightPost.position.x = 1.1;
    group.add(leftPost, rightPost);

    // Crossbar
    const crossGeom = new THREE.CylinderGeometry(0.08, 0.08, 2.4, 4);
    const crossbar = new THREE.Mesh(crossGeom, woodMat);
    crossbar.position.set(0, 2.4, 0);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.castShadow = true;
    group.add(crossbar);

    // Slanted Roof
    const roofGeom = new THREE.ConeGeometry(1.8, 1.0, 4);
    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.set(0, 2.9, 0);
    roof.rotation.y = Math.PI / 4; // align cone squares
    roof.castShadow = true;
    group.add(roof);

    return group;
  }

  public static createSprinklerModel(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'sprinkler';

    const ironMat = this.getMaterial('iron', { color: 0x475569, metalness: 0.8, roughness: 0.2 });
    const brassMat = this.getMaterial('brass', { color: 0xca8a04, metalness: 0.9, roughness: 0.1 });

    // Stand (iron spike)
    const standGeom = new THREE.CylinderGeometry(0.06, 0.08, 0.8, 5);
    const stand = new THREE.Mesh(standGeom, ironMat);
    stand.position.y = 0.4;
    stand.castShadow = true;
    group.add(stand);

    // Sprinkler core (brass ring)
    const coreGeom = new THREE.CylinderGeometry(0.16, 0.16, 0.18, 8);
    const core = new THREE.Mesh(coreGeom, brassMat);
    core.position.y = 0.85;
    core.castShadow = true;
    group.add(core);

    // Nozzles (two tiny pipes coming out of the core)
    const nozzleGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.35, 4);
    const leftNozzle = new THREE.Mesh(nozzleGeom, ironMat);
    leftNozzle.position.set(-0.15, 0.9, 0);
    leftNozzle.rotation.z = Math.PI / 2 - 0.2; // angled slightly up
    leftNozzle.castShadow = true;
    
    const rightNozzle = leftNozzle.clone();
    rightNozzle.position.x = 0.15;
    rightNozzle.rotation.z = -Math.PI / 2 + 0.2;
    group.add(leftNozzle, rightNozzle);

    // Custom spin property so we can rotate the top nozzle in game loop
    group.userData = { rotates: true, rotateSpeed: 5.0 };

    return group;
  }

  public static createScarecrowModel(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'scarecrow';

    const woodMat = this.getMaterial('woodLight', { color: 0xb45309, roughness: 0.8 });
    const clothMat = this.getMaterial('clothBlue', { color: 0x1d4ed8, roughness: 0.9 });
    const strawMat = this.getMaterial('strawYellow', { color: 0xeab308, roughness: 0.9 });
    const hatMat = this.getMaterial('hatBrown', { color: 0x78350f, roughness: 0.95 });

    // Main support post
    const postGeom = new THREE.CylinderGeometry(0.08, 0.1, 2.2, 5);
    const post = new THREE.Mesh(postGeom, woodMat);
    post.position.y = 1.1;
    post.castShadow = true;
    group.add(post);

    // Arm post cross
    const armGeom = new THREE.CylinderGeometry(0.06, 0.06, 1.8, 4);
    const arms = new THREE.Mesh(armGeom, woodMat);
    arms.position.set(0, 1.5, 0);
    arms.rotation.z = Math.PI / 2;
    arms.castShadow = true;
    group.add(arms);

    // Straw body (cylinder)
    const bodyGeom = new THREE.CylinderGeometry(0.35, 0.45, 0.9, 8);
    const body = new THREE.Mesh(bodyGeom, clothMat);
    body.position.set(0, 1.25, 0);
    body.castShadow = true;
    group.add(body);

    // Straw head
    const headGeom = new THREE.SphereGeometry(0.28, 8, 8);
    const head = new THREE.Mesh(headGeom, strawMat);
    head.position.set(0, 1.85, 0);
    head.castShadow = true;
    group.add(head);

    // Hat (cone with a wide flat brim)
    const brimGeom = new THREE.CylinderGeometry(0.55, 0.55, 0.04, 10);
    const brim = new THREE.Mesh(brimGeom, hatMat);
    brim.position.set(0, 2.05, 0);
    brim.rotation.z = 0.1; // slanting hat
    brim.castShadow = true;
    group.add(brim);

    const capGeom = new THREE.ConeGeometry(0.3, 0.4, 8);
    const cap = new THREE.Mesh(capGeom, hatMat);
    cap.position.set(0.02, 2.25, 0);
    cap.rotation.z = 0.1;
    cap.castShadow = true;
    group.add(cap);

    return group;
  }

  public static createFenceModel(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'fence';

    const woodMat = this.getMaterial('woodFence', { color: 0x854d0e, roughness: 0.9 });

    // Left post
    const postGeom = new THREE.BoxGeometry(0.15, 1.0, 0.15);
    const leftPost = new THREE.Mesh(postGeom, woodMat);
    leftPost.position.set(-0.9, 0.5, 0);
    leftPost.castShadow = true;
    
    // Right post
    const rightPost = leftPost.clone();
    rightPost.position.x = 0.9;
    group.add(leftPost, rightPost);

    // Top beam
    const beamGeom = new THREE.BoxGeometry(2.0, 0.1, 0.08);
    const topBeam = new THREE.Mesh(beamGeom, woodMat);
    topBeam.position.set(0, 0.75, 0);
    topBeam.castShadow = true;

    // Bottom beam
    const bottomBeam = topBeam.clone();
    bottomBeam.position.y = 0.35;
    group.add(topBeam, bottomBeam);

    return group;
  }
}
