import {Config} from '@remotion/cli/config';

// WebGL on the GPU under WSL2: ANGLE over EGL loads Mesa's d3d12 Gallium driver, which reaches the Windows GPU through /dev/dxg.
// Without these two variables Mesa falls back to llvmpipe (CPU), and the d3d12 driver picks the Intel iGPU first. See RENDERING.md.
process.env.GALLIUM_DRIVER ??= 'd3d12';
process.env.MESA_D3D12_DEFAULT_ADAPTER_NAME ??= 'NVIDIA';
Config.setChromiumOpenGlRenderer('angle-egl');
Config.setChromeMode('headless-shell');
Config.setVideoImageFormat('jpeg');
