<?php

$finder = PhpCsFixer\Finder::create()
    ->in( __DIR__ )
    ->exclude( 'vendor' )
    ->exclude( 'vendor-prefixed' )
    ->exclude( 'node_modules' )
    ->exclude( 'build' )
    ->exclude( 'public' );

$config = new PhpCsFixer\Config();

return $config
    ->setRules( [
        '@PSR12'           => true,
        'indentation_type' => true,
    ] )
    ->setFinder( $finder );
