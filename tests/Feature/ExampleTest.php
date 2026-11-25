<?php

namespace Tests\Feature;

use Tests\TestCase;

class ExampleTest extends TestCase
{
    public function test_the_chat_entry_page_loads(): void
    {
        $this->withoutVite()->get('/')->assertOk()->assertSee('HeyDay');
    }
}
