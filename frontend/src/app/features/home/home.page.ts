import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PlayerSessionService } from '../../core/player-session.service';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage implements OnInit {
  private readonly router = inject(Router);
  private readonly players = inject(PlayerSessionService);

  /** A returning gamer goes straight back to their game (or the game list). */
  ngOnInit(): void {
    if (!this.players.player()) return;
    const sessionId = this.players.sessionId();
    void this.router.navigate(sessionId ? ['/play', sessionId] : ['/play'], { replaceUrl: true });
  }
}
