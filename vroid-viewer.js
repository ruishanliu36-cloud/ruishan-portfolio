const libraries = Promise.all([import('three'), import('three/addons/loaders/GLTFLoader.js'), import('three/addons/controls/OrbitControls.js'), import('@pixiv/three-vrm')]);
libraries.catch(() => {});

for (const container of document.querySelectorAll('.vrm-viewer')) {
  const button = container.querySelector('.vrm-load');
  const status = container.querySelector('.vrm-status');
  button.addEventListener('click', async () => {
    if (button.disabled || button.hidden) return;
    button.disabled = true;
    status.textContent = 'Loading character…';
    let renderer;
    try {
      const [THREE, { GLTFLoader }, { OrbitControls }, { VRMLoaderPlugin, VRMUtils }] = await libraries;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      scene.add(new THREE.HemisphereLight(0xffffff, 0xb5a3ff, 1.5));
      const light = new THREE.DirectionalLight(0xffffff, 2);
      light.position.set(1, 2, 3);
      scene.add(light);
      const loader = new GLTFLoader();
      loader.register(parser => new VRMLoaderPlugin(parser));
      const gltf = await loader.loadAsync(new URL(container.dataset.model, document.baseURI).href, event => {
        if (event.total) status.textContent = `Loading character… ${Math.round(event.loaded / event.total * 100)}%`;
      });
      const vrm = gltf.userData.vrm;
      if (!vrm) throw new Error('Invalid VRM');
      VRMUtils.rotateVRM0(vrm);
// Natural standing pose
const humanoid = vrm.humanoid;

humanoid.getNormalizedBoneNode('leftUpperArm').rotation.z = -1.25;
humanoid.getNormalizedBoneNode('rightUpperArm').rotation.z = 1.25;

// Slight head tilt
humanoid.getNormalizedBoneNode('head').rotation.z = 0.06;
      scene.add(vrm.scene);
      vrm.scene.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(vrm.scene);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(center);
      controls.enableDamping = true;
      controls.enablePan = false;
      const resize = () => {
        const w = container.clientWidth, h = container.clientHeight;
        if (!w || !h) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      };
      resize();
      const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
      const distance = 1.2 * Math.max(size.y / 2 / Math.tan(halfFov), size.x / 2 / (Math.tan(halfFov) * camera.aspect)) + size.z / 2;
      camera.position.copy(center).add(new THREE.Vector3(0, 0, distance));
      controls.minDistance = Math.max(0.1, size.y * 0.2);
      controls.maxDistance = distance * 3;
      controls.update();
      button.hidden = true;
      status.textContent = '';
      container.appendChild(renderer.domElement);
      renderer.domElement.setAttribute('aria-label', 'Interactive 3D character');
      new ResizeObserver(resize).observe(container);
      let previous = performance.now();
      renderer.setAnimationLoop(now => {
        vrm.update(Math.min((now - previous) / 1000, 0.05));
        previous = now;
        controls.update();
        renderer.render(scene, camera);
      });
    } catch (error) {
      console.error(error);
      renderer?.dispose();
      button.disabled = false;
      status.textContent = 'Could not load character: ' + (error.message || 'Unknown error');
    }
  });
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) {
      observer.disconnect();
      button.click();
    }
  }, { rootMargin: '150px' });
  observer.observe(container);
}
