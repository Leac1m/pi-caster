import defaultFs from 'fs';

class PresentationState {
    constructor(fs = defaultFs) {
        this.fs = fs;
        this.receiverSocketId = null;
        this.remoteSocketId = null;
        this.activePresentationPath = null;
        this.activePresentationUrl = null;
        this.currentSlide = 1;
    }

    start({ path, url }) {
        this.activePresentationPath = path;
        this.activePresentationUrl = url;
        this.currentSlide = 1;
    }

    next() {
        this.currentSlide++;
    }

    prev() {
        if (this.currentSlide > 1) this.currentSlide--;
    }

    stop(fs = this.fs) {
        this.purge(fs);
    }

    purge(fs = this.fs) {
        if (this.activePresentationPath && fs.existsSync(this.activePresentationPath)) {
            try {
                fs.unlinkSync(this.activePresentationPath);
                console.log('Purged active presentation');
            } catch (e) {
                console.error('Failed to purge presentation', e);
            }
        }
        this.activePresentationPath = null;
        this.activePresentationUrl = null;
        this.currentSlide = 1;
    }

    reset() {
        this.receiverSocketId = null;
        this.remoteSocketId = null;
        this.activePresentationPath = null;
        this.activePresentationUrl = null;
        this.currentSlide = 1;
    }
}

const presentationStateSingleton = new PresentationState();

export { PresentationState, presentationStateSingleton };
