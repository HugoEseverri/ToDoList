import { Component, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatListModule } from '@angular/material/list';  // Importa MatListModule
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatListModule,
    FormsModule,
    MatIconModule
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  tasks: { text: string; completed: boolean }[] = [];
  newTask: string = '';
  filter: string = 'all'; // "all", "pending", "completed"

  constructor() {}

  ngOnInit() {
    this.loadTasks();
  }

  addTask() {
    if (this.newTask.trim()) {
      this.tasks.push({ text: this.newTask, completed: false });
      this.newTask = '';
      this.saveTasks();
    }
  }

  toggleTask(index: number) {
    this.tasks[index].completed = !this.tasks[index].completed;
    this.saveTasks();
  }

  deleteTask(index: number) {
    this.tasks.splice(index, 1);
    this.saveTasks();
  }

  saveTasks() {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      localStorage.setItem('tasks', JSON.stringify(this.tasks));
    }
  }

  loadTasks() {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      const storedTasks = localStorage.getItem('tasks');
      if (storedTasks) {
        this.tasks = JSON.parse(storedTasks);
      }
    }
  }

  // Filtrar tareas según el filtro seleccionado
  getFilteredTasks() {
    if (this.filter === 'pending') {
      return this.tasks.filter(task => !task.completed);
    } else if (this.filter === 'completed') {
      return this.tasks.filter(task => task.completed);
    }
    return this.tasks;
  }

  setFilter(filter: string) {
    this.filter = filter;
  }
}
