import { Component, Input } from '@angular/core';
import { TaskService } from '../../services/task.service';

@Component({
  selector: 'app-task',
  templateUrl: './task.component.html',
  styleUrls: ['./task.component.scss']
})
export class TaskComponent{
  @Input() task!: {text:string; completed: boolean; createdAt: Date}
  @Input() index!: number;

  constructor(private taskService: TaskService) {}

  toggleTask() {
    this.taskService.toggleTask(this.index);
  }

  deleteTask() {
    this.taskService.deleteTask(this.index);
  }
}



// import { Component } from '@angular/core';

// @Component({
//   selector: 'app-task',
//   templateUrl: './task.component.html',
//   styleUrls: ['./task.component.css']
// })
// export class TaskComponent {
//   tasks: { text: string, completed: boolean }[] = [];
//   newTask: string = '';

//   addTask() {
//     if (this.newTask.trim()) {
//       this.tasks.push({ text: this.newTask, completed: false });
//       this.newTask = '';
//     }
//   }

//   toggleTask(index: number) {
//     this.tasks[index].completed = !this.tasks[index].completed;
//   }

//   deleteTask(index: number) {
//     this.tasks.splice(index, 1);
//   }
// }
