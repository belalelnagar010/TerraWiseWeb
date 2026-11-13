import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SpaceBackgroundComponent } from './shared/space-background/space-background';
import { CursorComponent } from './shared/cursor/cursor';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SpaceBackgroundComponent, CursorComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = 'TerraWise';
}
