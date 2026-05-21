"""Flask CLI commands."""
from __future__ import annotations

import click
from flask import Flask
from flask.cli import AppGroup


def register_cli(app: Flask) -> None:
    seed_group = AppGroup("seed", help="Seed data utilities")

    @seed_group.command("run")
    def seed_run():
        """Insert realistic sample data for demos and tests."""
        from .seed import run_seed
        result = run_seed()
        click.echo(click.style(f"Seeded {result}", fg="green"))

    @seed_group.command("reset")
    def seed_reset():
        from .seed import reset_seed
        reset_seed()
        click.echo("Database reset.")

    app.cli.add_command(seed_group)
