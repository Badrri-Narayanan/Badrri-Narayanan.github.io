# Recipes

The recipes page (`recipes/index.html`) shows every `.json` file in `recipes/data/`.
To add a recipe, add one file there and push it to `master`. You don't need to change any code.

## Adding a recipe

1. Copy the template below into a new file such as `recipes/data/lemon-rice.json`.
   The file name becomes the recipe's link: `/recipes/#/lemon-rice`.
2. Fill it in, then commit and push.
3. It appears on the live site within a minute or two, once GitHub Pages has redeployed.

Files whose names start with `_` are ignored, so you can keep drafts as `_draft-lemon-rice.json`.

```json
{
    "title": "Lemon Rice",
    "altName": "Elumichai Sadam",
    "emoji": "🍋",
    "category": "Rice",
    "description": "One line about the dish, shown on its card.",
    "tags": ["rice", "quick"],
    "ingredients": [
        "2 cups Cooked rice",
        "1 Lemon (juiced)",
        {
            "group": "For the tempering",
            "items": ["2 tbsp Oil", "Mustard seeds", "Curry leaves"]
        }
    ],
    "steps": [
        { "title": "Tempering", "text": "Heat oil and add mustard seeds and curry leaves." },
        "Steps can also be plain text without a title."
    ],
    "tips": ["Optional tips appear under the method."]
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `title` | yes | The dish name. |
| `ingredients` | yes | Plain text lines, or `{ "group": "...", "items": [...] }` blocks for sub-lists. You can mix the two. |
| `steps` | yes | `{ "title": "...", "text": "..." }` objects, or plain text. |
| `altName` | no | Local or alternative name, shown under the title. |
| `emoji` | no | Picture for the card. Defaults to 🍽️. |
| `category` | no | Used for the filter buttons. Reuse an existing one to group recipes together, e.g. `Kuzhambu & Rasam`, `Breakfast & Tiffin`, `Rice`, `Sides & Poriyal`. |
| `description`, `tags`, `tips` | no | Tags and ingredient text are searchable. |

If a file has a mistake, such as a missing comma, the page still loads the other recipes and shows a yellow box naming the broken file.

## How the page finds the files

GitHub Pages can't list the contents of a folder, so on the live site the page asks the GitHub API for the file list of `recipes/data/`. That allows 60 requests an hour per visitor, and a visit uses one. If the API is unavailable, the page uses the last list it received.

To preview locally, run a server that shows folder listings from the repo root:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/recipes/
```
