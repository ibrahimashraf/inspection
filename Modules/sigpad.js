/* ==============================================================
   Modules/sigpad.js — Pointer signature pads & canvas operations
   ============================================================== */

function clearPad(n) {
	if (n === 1) liftingBatch[activeIdx].inspectorSigLive = null;
	else if (n === 2) liftingBatch[activeIdx].authSigLive = null;
	else if (n === 3) { const r = ndtBatch[activeIdx]; if (r) r.inspSigLive = null; }
	else if (n === 4) { const r = ndtBatch[activeIdx]; if (r) r.witSigLive = null; }
	redrawPadFromRecord('pad' + n, null);
	debouncedSync();
}

function _sizeSigPad(canvas) {
	if (!canvas) return false;
	const rect = canvas.getBoundingClientRect();
	if (rect.width < 1 || rect.height < 1) return false;
	const dpr = window.devicePixelRatio || 1;
	const newW = Math.max(2, Math.round(rect.width * dpr));
	const newH = Math.max(2, Math.round(rect.height * dpr));
	if (canvas.width === newW && canvas.height === newH) return true;

	let snapshot = null;
	if (canvas.width > 2 && canvas.height > 2) {
		snapshot = document.createElement('canvas');
		snapshot.width = canvas.width;
		snapshot.height = canvas.height;
		snapshot.getContext('2d').drawImage(canvas, 0, 0);
	}

	canvas.width = newW;
	canvas.height = newH;
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	ctx.strokeStyle = '#0f172a';
	ctx.lineWidth = 1.8 * dpr;

	if (snapshot) {
		ctx.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, newW, newH);
	}
	return true;
}

function sizeAllSigPads() {
	['pad1', 'pad2', 'pad3', 'pad4'].forEach(id => {
		_sizeSigPad(document.getElementById(id));
	});
}

function _cropTransparentSig(srcCanvas) {
	try {
		const w = srcCanvas.width, h = srcCanvas.height;
		if (w < 2 || h < 2) return srcCanvas.toDataURL();
		const ctx = srcCanvas.getContext('2d', { willReadFrequently: true });
		const imgData = ctx.getImageData(0, 0, w, h);
		const d = imgData.data;
		let minX = w, minY = h, maxX = -1, maxY = -1;
		for (let y = 0; y < h; y++) {
			const rowOff = y * w * 4;
			for (let x = 0; x < w; x++) {
				if (d[rowOff + x * 4 + 3] > 15) {
					if (x < minX) minX = x;
					if (x > maxX) maxX = x;
					if (y < minY) minY = y;
					if (y > maxY) maxY = y;
				}
			}
		}
		if (maxX < minX || maxY < minY) return srcCanvas.toDataURL();
		const pad = Math.max(10, Math.round(srcCanvas.width * 0.025));
		minX = Math.max(0, minX - pad);
		minY = Math.max(0, minY - pad);
		maxX = Math.min(w - 1, maxX + pad);
		maxY = Math.min(h - 1, maxY + pad);
		const cropW = maxX - minX + 1;
		const cropH = maxY - minY + 1;
		const c = document.createElement('canvas');
		c.width = cropW;
		c.height = cropH;
		const cCtx = c.getContext('2d');
		cCtx.drawImage(srcCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
		return c.toDataURL('image/png');
	} catch (err) {
		return srcCanvas.toDataURL();
	}
}

function setupPointerPad(canvas, onEnd, onDrawStart) {
	if (!canvas) return;
	const ctx = canvas.getContext('2d', { willReadFrequently: true });

	_sizeSigPad(canvas);

	let drawing = false;
	let lastX = 0, lastY = 0;

	function toCanvas(e) {
		const r = canvas.getBoundingClientRect();
		const scaleX = canvas.width / Math.max(1, r.width);
		const scaleY = canvas.height / Math.max(1, r.height);
		return {
			x: (e.clientX - r.left) * scaleX,
			y: (e.clientY - r.top)  * scaleY
		};
	}

	canvas.addEventListener('pointerdown', e => {
		e.preventDefault();
		if (canvas.width < 3 || canvas.height < 3) {
			if (!_sizeSigPad(canvas)) return;
		}
		if (onDrawStart) onDrawStart();
		drawing = true;
		const p = toCanvas(e);
		lastX = p.x;
		lastY = p.y;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.strokeStyle = '#0f172a';
		ctx.lineWidth = 1.8 * (window.devicePixelRatio || 1);
		ctx.beginPath();
		ctx.moveTo(p.x, p.y);
		ctx.lineTo(p.x + 0.01, p.y + 0.01);
		ctx.stroke();
		try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
	});

	canvas.addEventListener('pointermove', e => {
		if (!drawing) return;
		e.preventDefault();
		const p = toCanvas(e);
		ctx.lineWidth = 1.8 * (window.devicePixelRatio || 1);
		ctx.beginPath();
		ctx.moveTo(lastX, lastY);
		ctx.lineTo(p.x, p.y);
		ctx.stroke();
		lastX = p.x;
		lastY = p.y;
	});

	function end(e) {
		if (!drawing) return;
		drawing = false;
		try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
		if (onEnd) onEnd(_cropTransparentSig(canvas));
	}
	canvas.addEventListener('pointerup', end);
	canvas.addEventListener('pointercancel', end);
}
