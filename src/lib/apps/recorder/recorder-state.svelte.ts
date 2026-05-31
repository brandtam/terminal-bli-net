// Whether the Camera is currently recording. A tiny module store (mirrors how the
// VCR uses vcrPrefs) so the menu bar's REC badge can read it through the app's
// statusExtra — the OS's existing active-app status channel — instead of a bespoke
// bind: threaded through Desktop. RecorderWindow flips it on start/stop/cleanup.
let recording = $state(false);

export const recorderState = {
	get recording() {
		return recording;
	},
	set recording(v: boolean) {
		recording = v;
	}
};
