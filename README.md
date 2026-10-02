# törtchen.love

The public GitHub Pages file (`index.html`) contains one AES-256-GCM encrypted payload.
The human-readable source is `decrypted.index.html`, which is intentionally ignored by Git.

## Requirements

Node.js only. No npm packages.

## Edit locally

Edit:

    decrypted.index.html

Then rebuild the public encrypted page:

    node crypt.js encrypt

It prompts for the password without storing it in the repository.

For the current password you can also run:

    node crypt.js encrypt pw

but note that this exposes the password in your shell history.

## Recover/decrypt the source

If you clone the repository on a new machine and do not have `decrypted.index.html`:

    node crypt.js decrypt

Enter the password and it creates `decrypted.index.html`.

## Git workflow

    node crypt.js encrypt
    git add index.html crypt.js .gitignore .nojekyll README.md
    git commit -m "Update site"
    git push

`decrypted.index.html` is excluded by `.gitignore`.
