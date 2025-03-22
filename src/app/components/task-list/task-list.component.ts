import { Component, OnInit } from '@angular/core';
import { TaskService } from '../../services/task.service';
import { CommonModule, NgFor } from '@angular/common';
import { TaskComponent } from '../task/task.component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-task-list',
    imports: [
        CommonModule,
        TaskComponent,
        MatFormFieldModule,
        MatInputModule,
        MatIconModule,
        FormsModule,
        NgFor
    ],
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
