export class GUI {
    constructor() {
        this.questTitle = document.getElementById('quest-title');
        this.questStatus = document.getElementById('quest-status');
        this.questDescription = document.getElementById('quest-description');
    }

    updateQuest(title, status, description) {
        this.questTitle.textContent = title;
        this.questStatus.textContent = status;
        this.questDescription.textContent = description;
    }
} 