<?php

namespace Tests\Feature;

use Tests\TestCase;

class ThemeBootstrapTest extends TestCase
{
    public function test_the_home_page_applies_the_stored_theme_before_paint(): void
    {
        $this->get('/')
            ->assertOk()
            ->assertSee("localStorage.getItem('theme')", false)
            ->assertSee("document.documentElement.classList.toggle('dark', isDark)", false);
    }
}
