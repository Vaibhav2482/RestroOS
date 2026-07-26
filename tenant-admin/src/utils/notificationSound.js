let audioContext = null;

// A synthesized two-note chime via the Web Audio API instead of an audio
// file - nothing to host, and it plays instantly with no network round
// trip. Browsers block audio until a user gesture has happened somewhere
// on the page (logging in, clicking anywhere counts) - this fails silently
// before that rather than throwing, since a missed chime shouldn't break
// the page.
export const playNotificationSound = () => {

    try {

        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (audioContext.state === "suspended") {
            audioContext.resume();
        }

        const now = audioContext.currentTime;

        [0, 0.18].forEach((offset) => {

            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();

            oscillator.type = "sine";
            oscillator.frequency.value = 880;

            gain.gain.setValueAtTime(0, now + offset);
            gain.gain.linearRampToValueAtTime(0.3, now + offset + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.16);

            oscillator.connect(gain);
            gain.connect(audioContext.destination);

            oscillator.start(now + offset);
            oscillator.stop(now + offset + 0.18);

        });

    } catch {
        // Not critical - the toast/visual update still gets through.
    }

};
