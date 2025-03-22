import { Injectable } from "@angular/core";

@Injectable({
    providedIn: 'root'
})
export class TaskService {
    private tasks: { text: string; completed: boolean; createdAt: Date }[] = []

    constructor() {
        this.loadTasks();
    }

    addTask(text: string) {
        this.tasks.push({ text, completed: false, createdAt: new Date() });
        this.saveTasks();
    }

    toggleTask(index: number) {
        this.tasks[index].completed = !this.tasks[index].completed;
        this.saveTasks()
    }

    deleteTask(index: number) {
        this.tasks.splice(index, 1);
        this.saveTasks();
    }

    getTasks() {
        return this.tasks;
    }

    private saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(this.tasks));
    }

    loadTasks() {
        if (typeof window !== 'undefined') {
            const tasks = localStorage.getItem('tasks');
            return tasks ? JSON.parse(tasks) : [];
        }
        return [];
    }
}