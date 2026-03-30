<?php

/*
 * This file is part of the Symfony package.
 *
 * (c) Fabien Potencier <fabien@symfony.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 *
 * Modified by techtimo on 30-March-2026 using {@see https://github.com/BrianHenryIE/strauss}.
 */

namespace Spotmap\Symfony\Component\Yaml\Tag;

/**
 * @author Nicolas Grekas <p@tchwork.com>
 * @author Guilhem N. <egetick@gmail.com>
 */
final class TaggedValue
{
    public function __construct(
        private string $tag,
        private mixed $value,
    ) {
    }

    public function getTag(): string
    {
        return $this->tag;
    }

    public function getValue(): mixed
    {
        return $this->value;
    }
}
