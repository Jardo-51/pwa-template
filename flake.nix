{
  description = "Vue.js app dev environment with pnpm";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
  };

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = f:
        nixpkgs.lib.genAttrs systems (system: f (import nixpkgs { inherit system; }));
    in {

      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          buildInputs = [
            pkgs.nodejs
            pkgs.pnpm
          ];

          shellHook = ''
            echo "Node.js version: $(node -v)"
            echo "pnpm version: $(pnpm -v)"
          '';
        };

        playwright = pkgs.mkShell {
          buildInputs = [
            pkgs.nodejs
            pkgs.pnpm
          ];
          nativeBuildInputs = with pkgs; [ playwright-driver.browsers ];
          shellHook = ''
            export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}
            export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
          '';
        };
      });

    };
}
