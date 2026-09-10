<?php

namespace Tests\Feature;

// use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    /**
     * A basic test example.
     */
    public function test_the_application_returns_a_successful_response(): void
    {
        $response = $this->get('/');

        $response->assertStatus(200);
    }

    public function test_the_home_page_title_is_docs_playground(): void
    {
        $this->get('/')
            ->assertOk()
            ->assertSee('<title>Docs Playground</title>', false);
    }
}
