import { Component, OnInit } from '@angular/core';
import { TaskService } from '../../services/task.service';

@Component({
    selector: 'app-task-list',
    templateUrl: './task-list.component.html',
    styleUrls: ['./task-list.component.scss']
})
export class TaskListComponent implements OnInit {
    tasks: any[] = [];
    newTask = '';

    constructor(private taskService: TaskService) { }

    ngOnInit() {
        this.tasks = this.taskService.getTasks();
    }

    addTask() {
        if (this.newTask.trim()) {
            this.taskService.addTask(this.newTask);
            this.tasks = this.taskService.getTasks();
            this.newTask = '';
        }
    }
}
